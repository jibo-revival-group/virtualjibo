'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const readline = require('readline');

const SIM_ROOT = __dirname;
const JIBO_SPEAK = path.join(SIM_ROOT, 'tts-synth', 'jibo-speak');
const DEFAULT_VOICE = path.join(SIM_ROOT, '..', 'stuff', 'voices', 'en_us_world', path.sep);
const JIBO_LIB = path.join(SIM_ROOT, 'tts-synth', 'jibo-tts-sdk', 'lib');
const LD_LIBRARY_PATH = [JIBO_LIB, path.join(JIBO_LIB, 'poco'), process.env.LD_LIBRARY_PATH]
  .filter(Boolean)
  .join(':');

let currentPlayer = null;
let daemon = null;
let daemonRl = null;
let daemonReady = null;
let daemonVoiceDir = null;
let responseWaiters = [];
let readyResolve = null;
let synthQueue = Promise.resolve();
let speakGeneration = 0;

function normalizeVoiceDir(dir) {
  const resolved = path.resolve(dir);
  return resolved.endsWith(path.sep) ? resolved : resolved + path.sep;
}

function getVoiceDir() {
  return normalizeVoiceDir(process.env.JIBO_VOICE_DIR || DEFAULT_VOICE);
}

function stripMarkup(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function onDaemonLine(line) {
  if (line === 'READY') {
    if (readyResolve) {
      readyResolve();
    }
    return;
  }
  if (line === 'PONG') {
    return;
  }
  if (!responseWaiters.length) {
    return;
  }
  if (line !== 'OK' && !line.startsWith('ERR')) {
    return;
  }
  const waiter = responseWaiters.shift();
  if (waiter) {
    waiter(line);
  }
}

function attachDaemonStdout(proc) {
  if (daemonRl) {
    daemonRl.close();
  }
  daemonRl = readline.createInterface({ input: proc.stdout });
  daemonRl.on('line', onDaemonLine);
}

function startDaemon(voiceDir) {
  if (daemon && !daemon.killed && daemonVoiceDir === voiceDir) {
    return daemonReady;
  }

  stopDaemon();

  daemonVoiceDir = voiceDir;
  const env = Object.assign({}, process.env, { LD_LIBRARY_PATH });

  daemonReady = new Promise((resolve, reject) => {
    readyResolve = () => {
      readyResolve = null;
      resolve(daemon);
    };
    daemon = spawn(JIBO_SPEAK, ['--daemon', voiceDir], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    attachDaemonStdout(daemon);

    daemon.stderr.on('data', (chunk) => {
      const msg = String(chunk).trim();
      if (msg) console.warn('[tts-audio]', msg);
    });

    daemon.on('error', reject);
    daemon.on('exit', (code, signal) => {
      if (daemonRl) {
        daemonRl.close();
        daemonRl = null;
      }
      daemon = null;
      daemonReady = null;
      daemonVoiceDir = null;
      readyResolve = null;
      while (responseWaiters.length) {
        const waiter = responseWaiters.shift();
        if (typeof waiter === 'function') {
          waiter('ERR daemon exited');
        }
      }
      if (signal !== 'SIGTERM' && code !== 0 && code !== null) {
        console.warn('[tts-audio] synth daemon exited:', code || signal);
      }
    });
  });

  return daemonReady;
}

function stopDaemon() {
  if (daemon) {
    try { daemon.kill('SIGTERM'); } catch {}
    daemon = null;
    daemonReady = null;
    daemonVoiceDir = null;
  }
  if (daemonRl) {
    daemonRl.close();
    daemonRl = null;
  }
  responseWaiters = [];
}

function requestSynth(text, wavPath) {
  return startDaemon(getVoiceDir()).then((proc) => new Promise((resolve, reject) => {
    responseWaiters.push((line) => {
      if (line === 'OK') resolve(wavPath);
      else reject(new Error(line.startsWith('ERR') ? line : 'synthesis failed'));
    });
    proc.stdin.write(`${wavPath}\t${text}\n`);
  }));
}

function warmup() {
  if (!fs.existsSync(JIBO_SPEAK)) return Promise.resolve();
  const voiceDir = getVoiceDir();
  if (!fs.existsSync(voiceDir)) return Promise.resolve();
  return startDaemon(voiceDir).catch((err) => {
    console.warn('[tts-audio] warmup failed:', err.message);
  });
}

function speakPrompt(prompt) {
  const text = stripMarkup(prompt);
  if (!text) return;

  if (!fs.existsSync(JIBO_SPEAK)) {
    console.warn('[tts-audio] jibo-speak missing; run `make` in simulator/tts-synth');
    return;
  }

  const voiceDir = getVoiceDir();
  if (!fs.existsSync(voiceDir)) {
    console.warn('[tts-audio] voice dir not found:', voiceDir);
    return;
  }

  stopPlayback();
  const generation = ++speakGeneration;
  const wavPath = path.join(os.tmpdir(), `jibo-tts-${process.pid}-${Date.now()}.wav`);

  synthQueue = synthQueue.then(() => {
    if (generation !== speakGeneration) return null;
    return requestSynth(text, wavPath);
  }).then((readyPath) => {
    if (!readyPath || generation !== speakGeneration) {
      try { fs.unlinkSync(wavPath); } catch {}
      return;
    }
    playWav(readyPath, generation);
  }).catch((err) => {
    if (generation === speakGeneration) {
      console.warn('[tts-audio] synthesis failed:', err.message);
    }
    try { fs.unlinkSync(wavPath); } catch {}
  });
}

function playWav(wavPath, generation) {
  const players = [
    ['aplay', ['-q', wavPath]],
    ['paplay', [wavPath]],
    ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', wavPath]],
  ];

  const tryNext = (index) => {
    if (generation !== speakGeneration) {
      try { fs.unlinkSync(wavPath); } catch {}
      return;
    }
    if (index >= players.length) {
      console.warn('[tts-audio] no audio player found (tried aplay, paplay, ffplay)');
      try { fs.unlinkSync(wavPath); } catch {}
      return;
    }
    const [cmd, args] = players[index];
    const proc = spawn(cmd, args, { stdio: 'ignore' });
    proc.on('error', () => tryNext(index + 1));
    proc.on('exit', () => {
      if (currentPlayer === proc) currentPlayer = null;
      try { fs.unlinkSync(wavPath); } catch {}
    });
    currentPlayer = proc;
  };

  tryNext(0);
}

function stopPlayback() {
  if (currentPlayer) {
    try { currentPlayer.kill(); } catch {}
    currentPlayer = null;
  }
}

function stopSpeaking() {
  speakGeneration++;
  stopPlayback();
}

warmup();

module.exports = { speakPrompt, stopSpeaking, warmup };

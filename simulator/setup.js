#!/usr/bin/env node
/**
 * Post-install: populate simulator/node_modules/ with symlinks to all the Jibo
 * packages. We do this instead of `file:` references in package.json because
 * those would trigger npm to recursively install the Jibo packages' transitive
 * deps, many of which are private and would fail to resolve.
 *
 * Idempotent: running it twice is safe; existing symlinks pointing at the
 * right target are left alone.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SIM_DIR = __dirname;                          // simulator/
const REPO_DIR = path.resolve(SIM_DIR, '..');       // jibo-cli/
const STUFF_DIR = path.join(REPO_DIR, 'stuff');     // jibo-cli/stuff/
const NM_DIR = path.join(SIM_DIR, 'node_modules');  // simulator/node_modules/
const SHIM_DIR = path.join(SIM_DIR, 'shim');        // simulator/shim/
const BE_NM_DIR = path.join(STUFF_DIR, '@be', 'be', 'node_modules');

if (!fs.existsSync(NM_DIR)) {
  console.error('[setup] simulator/node_modules/ does not exist; run `npm install` first.');
  process.exit(1);
}

/**
 * Each entry maps `linkName` -> absolute target dir, plus a `mode`:
 *   'copy' - hard-copy the package into node_modules (use for packages whose
 *            transitive deps must be resolved from simulator/node_modules/)
 *   'link' - symlink (use for packages with self-contained dep trees, e.g.
 *            anything pulled from stuff/@be/be/node_modules/)
 */
const links = [];

function addLink(linkName, targetDir, mode) {
  links.push({ linkName, targetDir, mode: mode || 'link' });
}

// --- Top-level Jibo packages from stuff/ ---------------------------------
//   These get COPIED so their transitive `require(...)` calls resolve from
//   simulator/node_modules/ rather than from stuff/.

addLink('animation-utilities',     path.join(STUFF_DIR, 'animation-utilities-6.0.3', 'package'),  'copy');
addLink('jibo-client-framework',   path.join(STUFF_DIR, 'jibo-client-framework-5.0.3', 'package'), 'copy');
addLink('jibo-kb',                 path.join(STUFF_DIR, 'jibo-kb-9.0.3', 'package'),               'copy');
addLink('jibo-service-framework',  path.join(STUFF_DIR, 'jibo-service-framework-5.0.3', 'package'),'copy');
addLink('jibo-sync',               path.join(STUFF_DIR, 'jibo-sync-6.0.3', 'package'),             'copy');
// jibo-log: stuff/ has v0.3.0 but jibo-service-framework@5.0.3 needs v5.x's named
// `Log` export. Use Be's bundled v5.0.18 instead. (Symlink \u2014 it has its own deps.)
addLink('jibo-log',                path.join(BE_NM_DIR, 'jibo-log'),                               'link');
addLink('jibo-attention-manager',  path.join(STUFF_DIR, 'jibo-attention-manager-7.0.3', 'package'),'copy');
addLink('jibo-dof-arbiter',        path.join(STUFF_DIR, 'jibo-dof-arbiter-5.0.3', 'package'),      'copy');
addLink('rule-generator',          path.join(STUFF_DIR, 'rule-generator-6.0.3', 'package'),        'copy');
addLink('jibo-server-client',      path.join(STUFF_DIR, 'jibo-server-client-3.0.117', 'package'),  'copy');
// Real SSM 14 under a side name; the shim re-exports from it.
addLink('skills-service-manager-real', path.join(STUFF_DIR, 'skills-service-manager-14.2.9', 'package'), 'copy');

// --- @jibo scoped packages from stuff/@jibo/ -----------------------------

const STUFF_JIBO = path.join(STUFF_DIR, '@jibo');
addLink('@jibo/three',                 path.join(STUFF_JIBO, 'three'),               'copy');
// @jibo/three with global.realThree loads three/three.min.js; without this link
// picking (head touch, LPS) gets a stripped THREE missing Raycaster/unproject.
addLink('three',                       path.join(BE_NM_DIR, 'three'),                'link');
addLink('@jibo/analytics-node',        path.join(STUFF_JIBO, 'analytics-node'),      'copy');
addLink('@jibo/interfaces',            path.join(STUFF_JIBO, 'interfaces'),          'copy');
addLink('@jibo/jetstream-client',      path.join(STUFF_JIBO, 'jetstream-client'),    'copy');
addLink('@jibo/jibo-server-client',    path.join(STUFF_JIBO, 'jibo-server-client'),  'copy');
addLink('@jibo/ws',                    path.join(STUFF_JIBO, 'ws'),                  'copy');
addLink('@jibo/chitchat-mims',         path.join(STUFF_JIBO, 'chitchat-mims'),       'copy');

// --- Unscoped -> scoped relocation ---------------------------------------

addLink('@jibo/parser-download',       path.join(STUFF_DIR, 'parser-download-3.0.0', 'package'), 'copy');

// --- Shims ---------------------------------------------------------------
//   Shims live inside the simulator tree, so symlinks are fine.

addLink('skills-service-manager',      path.join(SHIM_DIR, 'skills-service-manager'), 'link');
addLink('@jibo/hub-client',            path.join(SHIM_DIR, '@jibo', 'hub-client'),    'link');
addLink('jibo-singletons',             path.join(SHIM_DIR, 'jibo-singletons'),        'link');
addLink('jibo-sync-stage',             path.join(SHIM_DIR, 'jibo-sync-stage'),        'link');

// --- Symlinks from Be skill's node_modules (private Jibo packages we don't
//     have standalone copies of). These satisfy SSM 14's transitive deps. -----

const BE_PROVIDED = [
  'jibo-cai-utils', 'jibo-common-types', 'jibo-expression-client',
  'jibo-service-clients', 'jibo-state-machine', 'jibo-typed-events',
  'jibo-node-xml', 'jibo-action-system', 'jibo-anim-db-animations',
  'jibo-anim-db', 'jibo-loader', 'jibo-flow-core', 'jibo-emotion-system',
  'jibo-embodied-dialog', 'jibo-data-utils', 'jibo-keyframes',
  'jibo-plugins', 'jibo-tunable', 'jibo-tbd', 'jibo-radio',
  'jibo-cai-persistence', 'jibo-cai-singleton', 'jibo-command-protocol',
  'jibo-command-library', 'jibo-eventemitter3', 'jibo-interaction-memory',
  'application-metrics'
];
for (const pkg of BE_PROVIDED) {
  const target = path.join(BE_NM_DIR, pkg);
  if (fs.existsSync(target)) addLink(pkg, target, 'link');
}

// --- Materialise -----------------------------------------------------------

let created = 0;
let skipped = 0;
let failed = 0;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, entry.name);
    const dp = path.join(dst, entry.name);
    if (entry.isSymbolicLink()) {
      const link = fs.readlinkSync(sp);
      try { fs.symlinkSync(link, dp); } catch {}
    } else if (entry.isDirectory()) {
      copyDirSync(sp, dp);
    } else if (entry.isFile()) {
      fs.copyFileSync(sp, dp);
    }
  }
}

for (const { linkName, targetDir, mode } of links) {
  if (!fs.existsSync(targetDir)) {
    console.warn(`[setup] target missing for ${linkName}: ${targetDir}`);
    failed += 1;
    continue;
  }
  const dstPath = path.join(NM_DIR, linkName);
  ensureDir(path.dirname(dstPath));

  // Decide whether the existing entry is already correct.
  try {
    const existing = fs.lstatSync(dstPath);
    if (mode === 'link' && existing.isSymbolicLink()) {
      const cur = fs.readlinkSync(dstPath);
      const resolvedCur = path.resolve(path.dirname(dstPath), cur);
      if (resolvedCur === targetDir) { skipped += 1; continue; }
    }
    // Wipe whatever is there.
    if (existing.isSymbolicLink() || existing.isFile()) {
      fs.unlinkSync(dstPath);
    } else if (existing.isDirectory()) {
      fs.rmSync(dstPath, { recursive: true, force: true });
    }
  } catch { /* doesn't exist; fine */ }

  try {
    if (mode === 'copy') {
      copyDirSync(targetDir, dstPath);
    } else {
      fs.symlinkSync(targetDir, dstPath, 'dir');
    }
    created += 1;
  } catch (e) {
    console.error(`[setup] failed to ${mode} ${linkName} \u2190 ${targetDir}: ${e.message}`);
    failed += 1;
  }
}

console.log(`[setup] materialised ${created} packages, skipped ${skipped} unchanged, ${failed} failed.`);

// --- Post-copy patches -------------------------------------------------------

// patchFile applies in-place string replacements, keeping a one-time backup
// at <file>.orig the first time so re-running setup is idempotent.
function patchFile(filePath, replacements, label) {
  if (!fs.existsSync(filePath)) return;
  const backup = filePath + '.orig';
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(filePath, backup);
  }
  let src = fs.readFileSync(backup, 'utf8'); // patch from pristine backup
  let touched = false;
  for (const [from, to] of replacements) {
    if (src.includes(from)) {
      src = src.split(from).join(to);
      touched = true;
    }
  }
  if (touched) {
    fs.writeFileSync(filePath, src, 'utf8');
    console.log(`[setup] patched ${label}`);
  }
}

// Fix `"ws:" + host + ":" + port` \u2192 `"ws://" + host + ":" + port`.
// Modern `ws` rejects the former as "invalid url".
const WS_BUG_FIX = [[
  '"ws:" + service.host + ":" + service.port',
  '"ws://" + service.host + ":" + service.port'
]];
patchFile(
  path.join(BE_NM_DIR, 'jibo-service-clients', 'lib', 'jibo-service-clients.js'),
  WS_BUG_FIX,
  'jibo-service-clients/lib/jibo-service-clients.js (ws URL)'
);
patchFile(
  path.join(BE_NM_DIR, 'jibo-service-clients', 'lib', 'expression-service-clients', 'index.js'),
  WS_BUG_FIX,
  'jibo-service-clients/lib/expression-service-clients/index.js (ws URL)'
);
patchFile(
  path.join(BE_NM_DIR, 'jibo', 'lib', 'jibo.js'),
  WS_BUG_FIX,
  'jibo/lib/jibo.js (ws URL)'
);

// Same bug exists in SSM 14 itself.
const SSM_FIXES = [
  // ws URL bug.
  ['"ws:" + record.host + ":" + record.port',
   '"ws://" + record.host + ":" + record.port'],
  ['`ws:${sm.host}:${sm.port}',
   '`ws://${sm.host}:${sm.port}'],
  // SkillsService.init() awaits ScreenScheduler.stopTimerAndTurnOn(), which
  // calls BodyClient.setScreen('on') and rejects when the body service replies
  // with non-JSON (it does, in the simulator). The unhandled rejection means
  // SkillsService never callbacks, hanging the orchestrator. Swallow it.
  ['ScreenScheduler_1.default.stopTimerAndTurnOn().then(',
   'ScreenScheduler_1.default.stopTimerAndTurnOn().catch(()=>{}).then('],
  // SSM 14 SkillsService crashes on initDone when currentSkill is null (Be sends
  // initDone on startup before any launch()). SSM 10's SkillsServiceSim pre-set
  // currentSkill and always replied with 'show'. Without 'show', Be's Lifecycle
  // plugin never completes jibo.init — splash stays forever.
  [`    onMessage(command, client) {
        if (command.command === 'initDone') {
            log.info(this.currentSkill.name, 'launched and initialized');
            this.emit('hide');
            this.sendWsJson(client, {
                command: 'show'
            });
        }`,
   `    onMessage(command, client) {
        if (command.command === 'initDone') {
            if (!this.currentSkill && this.options.skillsBaseDir) {
                let skillPath = this.options.skillsBaseDir;
                let packagePath = path.join(this.options.skillsBaseDir, 'package.json');
                if (fs.statSync(skillPath).isDirectory() && fs.existsSync(packagePath)) {
                    let packageJson = require(packagePath);
                    this.currentSkill = { name: packageJson.name, path: skillPath };
                }
            }
            if (this.currentSkill) {
                log.info(this.currentSkill.name, 'launched and initialized');
            } else {
                log.info('Skill initDone (no currentSkill yet)');
            }
            this.emit('hide');
            this.sendWsJson(client, {
                command: 'show'
            });
        }`],
  // JetstreamServiceSim polls for Be's ContextService (registered late). Don't
  // reject with an unhandled error after 20s — context arrives once BeSkill.init runs.
  [`                        reject(new Error(\`Timeout in Jetstream sim waiting for context service\`));`,
   `                        log_1.default.warn('Timeout waiting for context service — continuing without context client');
                        this.state = oldState;
                        resolve();`],
  // Offline sim has no loop/account; MediaListManager._syncWithCloud can hang on
  // JSC Media#list when loopId is missing, blocking SyncManagers and Factory.init
  // (3D robot + webview never start). Skip blocking full sync like a warm boot.
  [`    _setupCanSkipFullSync(lastCredentialsHash) {
        if (SyncManager.canSkipFullSync !== undefined) {
            log.warn('_setupCanSkipFullSync was already called, ignoring');
            return;
        }
        SyncManager.canSkipFullSync = false;`,
   `    _setupCanSkipFullSync(lastCredentialsHash) {
        if (SyncManager.canSkipFullSync !== undefined) {
            log.warn('_setupCanSkipFullSync was already called, ignoring');
            return;
        }
        SyncManager.canSkipFullSync = true;
        log.info('simulator: skipping blocking KB cloud full sync');
        return;`],
  [`        this._setupLoopAndOwnerId((err) => {
            if (!err) {
                this._getFullMediaList(this.loopId, (err, data) => {
                    this._endTimer('JSC server call Media#list() (all pages)');`,
   `        this._setupLoopAndOwnerId((err) => {
            if (!err && !this.loopId) {
                log.warn('no loopId for media list sync, skipping');
                return callback(new Error('no loopId'));
            }
            if (!err) {
                this._getFullMediaList(this.loopId, (err, data) => {
                    this._endTimer('JSC server call Media#list() (all pages)');`],
  // Cloud API + connectivity checks: point at api.5x1.com:80 (override via JIBO_CLOUD_* env).
  ['jibo_server_1.JSC.config.update(credentials);',
   'jibo_server_1.JSC.config.update(Object.assign({}, credentials, { endpoint: process.env.JIBO_CLOUD_HOST || "http://api.5x1.com:80", sslEnabled: false }));'],
  [`            if (!err) {
                this._jiboServerUrl = data.region + ".jibo.com";
            }
            else {
                this._jiboServerUrl = this._wifiService.options.region + ".jibo.com";
            }`,
   `            this._jiboServerUrl = process.env.JIBO_CLOUD_HOSTNAME || "api.5x1.com";`],
  [`const https = require("https");
const fs = require("fs");
const jibo_cai_utils_1 = require("jibo-cai-utils");
const promisify = jibo_cai_utils_1.PromiseUtils.promisify;
const log = log_1.default.createChild("WiFiManager");`,
   `const http = require("http");
const https = require("https");
const fs = require("fs");
const jibo_cai_utils_1 = require("jibo-cai-utils");
const promisify = jibo_cai_utils_1.PromiseUtils.promisify;
const log = log_1.default.createChild("WiFiManager");`],
  [`            let options = {
                host: this._jiboServerUrl,
                path: '/'
            };
            let req = https.get(options, (res) => {`,
   `            let options = {
                host: this._jiboServerUrl,
                port: parseInt(process.env.JIBO_CLOUD_PORT || "80", 10),
                path: '/'
            };
            let req = http.get(options, (res) => {`],
  [`    API: 'api.jibo.com',`,
   `    API: 'api.5x1.com',`],
  [`const HUB_OPTIONS = {
    hostname: 'localhost',
    path: null,
    port: 9000,`,
   `const HUB_OPTIONS = {
    hostname: 'api.5x1.com',
    path: null,
    port: 80,`],
  [`const DEFAULT_TESTING_CREDENTIALS = {
    secretAccessKey: 'W5dxPYfmdGTETneE1LeuIcp8aCXrgr4eomrfW50s',
    accessKeyId: '3MRGwcKUvQuAk8Hsl7Xp',
    region: 'stg-entrypoint'
};`,
   `const DEFAULT_TESTING_CREDENTIALS = {
    secretAccessKey: 'W5dxPYfmdGTETneE1LeuIcp8aCXrgr4eomrfW50s',
    accessKeyId: '3MRGwcKUvQuAk8Hsl7Xp',
    region: 'api'
};`],
  // BodyService sim never broadcast head touch pad state; Be listens on ws://…/touch.
  [`        this.touchSocketList = [];
        this.commandSocketList = [];`,
   `        this.touchSocketList = [];
        this.pad_state = [false, false, false, false, false, false];
        this.commandSocketList = [];`],
  [`    update() {
        this.updateLoop = setTimeout(this.update, 100);
        let dofs = {
            topSection_r: this.state.neck.pos,`,
   `    routes(url) {
        super.routes(url);
        url.post('/touch', (req, res) => {
            this.simulateTouchState(req.body || {});
            this.sendJson(res, {}, 204);
        });
    }
    simulateTouchState(body) {
        const raw = body.pad_state || body.padState || [];
        const next = [];
        for (let i = 0; i < 6; i++) {
            next.push(!!raw[i]);
        }
        const changed = [];
        for (let i = 0; i < 6; i++) {
            if (next[i] !== !!this.pad_state[i]) {
                changed.push(i);
            }
        }
        if (!changed.length) {
            return;
        }
        this.pad_state = next;
        const msg = {
            ts: animation_utilities_1.Clock.currentTime()._timestamp,
            touched: this.pad_state.indexOf(true) >= 0,
            pad_state: this.pad_state.slice(),
            changed: changed
        };
        for (let sock of this.touchSocketList) {
            this.sendWsJson(sock, msg);
        }
    }
    update() {
        this.updateLoop = setTimeout(this.update, 100);
        let dofs = {
            topSection_r: this.state.neck.pos,`],
  // Audible TTS: synthesize with Jibo voice and play on host speakers.
  [`            const promptTokens = parser.createPromptAndTokens(data.prompt);
            const realTime = (this.mode === TTSPromptParser_1.TTSPlaybackMode.Incremental);`,
   `            const promptTokens = parser.createPromptAndTokens(data.prompt);
            try { require('../../../tts-audio').speakPrompt(promptTokens[0]); } catch (e) { log.warn('TTS audio: ' + e.message); }
            const realTime = (this.mode === TTSPromptParser_1.TTSPlaybackMode.Incremental);`],
  [`    stopCurrentWorker() {
        if (this.currentWorker) {`,
   `    stopCurrentWorker() {
        try { require('../../../tts-audio').stopSpeaking(); } catch (e) {}
        if (this.currentWorker) {`],
  [`            this.mode = TTSPromptParser_1.TTSPlaybackMode.Instant;
        }
    }
    init(callback) {
        super.init((err) => {
            log.info('Initialized');
            callback(err);
        });
    }
    onMessage(command, client) {
        return;
    }`,
   `            this.mode = TTSPromptParser_1.TTSPlaybackMode.Instant;
        }
    }
    init(callback) {
        super.init((err) => {
            log.info('Initialized');
            try { require('../../../tts-audio').warmup(); } catch (e) {}
            callback(err);
        });
    }
    onMessage(command, client) {
        return;
    }`],
];
patchFile(
  path.join(NM_DIR, 'skills-service-manager-real', 'lib', 'skills-service-manager.js'),
  SSM_FIXES,
  'skills-service-manager-real/lib/skills-service-manager.js (ws URL + screen + head touch)'
);
patchFile(
  path.join(NM_DIR, 'skills-service-manager-real', 'lib', 'expression-process.js'),
  SSM_FIXES,
  'skills-service-manager-real/lib/expression-process.js (ws URL)'
);

const JSC_ENDPOINT_PATCH = [[
  'jibo_server_1.JSC.config.update(credentials);',
  'jibo_server_1.JSC.config.update(Object.assign({}, credentials, { endpoint: process.env.JIBO_CLOUD_HOST || "http://api.5x1.com:80", sslEnabled: false }));'
]];
patchFile(
  path.join(NM_DIR, 'skills-service-manager-real', 'lib', 'scs-process.js'),
  JSC_ENDPOINT_PATCH,
  'scs-process.js (JSC endpoint)'
);
patchFile(
  path.join(NM_DIR, 'skills-service-manager-real', 'lib', 'mms-process.js'),
  JSC_ENDPOINT_PATCH,
  'mms-process.js (JSC endpoint)'
);

patchFile(
  path.join(NM_DIR, '@jibo', 'jibo-server-client', 'lib', 'region_config.json'),
  [
    ['"endpoint": "https://{region}.jibo.com"', '"endpoint": "http://api.5x1.com:80"'],
    ['"wsendpoint": "wss://{region}-socket.jibo.com"', '"wsendpoint": "ws://api.5x1.com:80"'],
    ['"endpoint": "http://{region}.jibo.com:8080"', '"endpoint": "http://api.5x1.com:80"'],
    ['"wsendpoint": "ws://{region}-socket.jibo.com:8090"', '"wsendpoint": "ws://api.5x1.com:80"'],
  ],
  '@jibo/jibo-server-client/lib/region_config.json (api.5x1.com)'
);

// client.js uses get-skill-path for skillsBaseDir and get-skill-entry-url for webview src.
patchFile(
  path.join(SIM_DIR, 'client.js'),
  [[
    'o.src=y.ipcRenderer.sendSync("get-skill-path")',
    'o.src=y.ipcRenderer.sendSync("get-skill-entry-url")'
  ], [
    'skillsBaseDir:E.join(y.ipcRenderer.sendSync("get-skill-path"),"..")',
    'skillsBaseDir:y.ipcRenderer.sendSync("get-skill-path")'
  ], [
    'this.face.style.zIndex=i(s)?"-1":"0"});',
    'this.face.style.zIndex=i(s)?"-1":"0",window.__jiboSimFaceQuad={corners:s.map(p=>({x:p.x,y:p.y})),behind:!!i(s)}});'
  ], [
    'this.robotRenderer=e,this.container.className+="loading"',
    'this.robotRenderer=e,window.__jiboSimRobot=e,this.container.className+="loading"'
  ], [
    'setMode(e){this.mode=e}',
    'setMode(e){this.mode=e,window.__jiboSimMode=e}'
  ]],
  'client.js (webview src + skillsBaseDir + face quad + head touch hooks)'
);

// Electron 30+ / modern Chromium: emscripten heap ArrayBuffers are not
// transferable; Crunch worker postMessage throws and GUI textures never load.
patchFile(
  path.join(BE_NM_DIR, 'jibo', 'resources', 'workerJS', 'webgl-texture-util.js'),
  [[
    `      function uploadCallback(dxtData, width, height, levels, format) {
          postMessage({
              data: dxtData,
              width: width,
              height: height,
              levels: levels,
              format: format
          }, [dxtData.buffer || dxtData]);
      }`,
    `      function uploadCallback(dxtData, width, height, levels, format) {
          var payload = dxtData instanceof ArrayBuffer
              ? new Uint8Array(dxtData)
              : new Uint8Array(dxtData.buffer, dxtData.byteOffset, dxtData.byteLength);
          try {
              postMessage({
                  data: payload,
                  width: width,
                  height: height,
                  levels: levels,
                  format: format
              }, [payload.buffer]);
          } catch (transferErr) {
              postMessage({
                  data: payload,
                  width: width,
                  height: height,
                  levels: levels,
                  format: format
              });
          }
      }`
  ]],
  'jibo/resources/workerJS/webgl-texture-util.js (ArrayBuffer transfer)'
);

// --- KB seed for simulator ---------------------------------------------------
// Skip first-contact on repeat boots; launch @be/idle instead.
const KB_SKILLS_CONFIG = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.jibo', 'kb', 'skills-config', 'nodes'
);
try {
  if (process.env.HOME || process.env.USERPROFILE) {
    const dir = path.dirname(KB_SKILLS_CONFIG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(KB_SKILLS_CONFIG)) {
      const now = Date.now();
      const node = {
        _id: 'sim-skills-config-root',
        type: 'root',
        data: { hasAlreadyLaunchedFirstContact: true },
        created: now,
        updated: now
      };
      fs.writeFileSync(KB_SKILLS_CONFIG, JSON.stringify(node) + '\n', 'utf8');
      console.log('[setup] seeded ~/.jibo/kb/skills-config (skip first-contact)');
    }
  }
} catch (e) {
  console.warn('[setup] KB skills-config seed failed:', e.message);
}

// --- Jibo voice synthesizer (simulator/tts-synth) ---------------------------
const { spawnSync } = require('child_process');
const ttsSynthDir = path.join(SIM_DIR, 'tts-synth');
const jiboSpeakBin = path.join(ttsSynthDir, 'jibo-speak');
if (fs.existsSync(path.join(ttsSynthDir, 'Makefile'))) {
  if (!fs.existsSync(jiboSpeakBin)) {
    console.log('[setup] building simulator/tts-synth/jibo-speak...');
    const mk = spawnSync('make', [], { cwd: ttsSynthDir, encoding: 'utf8' });
    if (mk.status === 0 && fs.existsSync(jiboSpeakBin)) {
      console.log('[setup] built jibo-speak');
    } else {
      console.warn('[setup] jibo-speak build failed; TTS will be lip-sync only');
      if (mk.stderr) console.warn(mk.stderr.trim());
    }
  }
} else {
  console.warn('[setup] simulator/tts-synth missing; audible TTS disabled');
}

process.exit(failed > 0 ? 1 : 0);

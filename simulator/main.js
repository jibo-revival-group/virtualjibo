/**
 * Modernized Electron main process for the Jibo simulator.
 *
 * Replaces the minified simulator/app.js (built for Electron 1.4.3 in 2017)
 * with one that runs on Electron 30+. The renderer (index.html + client.js)
 * is unchanged; we just have to expose the same IPC channels and CLI flags
 * the renderer expects.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu, ipcMain, screen, globalShortcut } = require('electron');
const { Command } = require('commander');
const fse = require('fs-extra');
const _ = require('lodash');
const findRoot = require('find-root');

// Renderer console forwarding can flood stdout; if the terminal pipe closes
// (closed tab, `| head`, etc.) uncaught EPIPE crashes the whole Electron app.
function safeStdoutWrite(msg) {
  if (!process.stdout.writable || process.stdout.destroyed) return;
  process.stdout.write(msg, (err) => {
    if (err && err.code !== 'EPIPE' && err.code !== 'ERR_STREAM_DESTROYED') {
      console.error('[stdout]', err.message);
    }
  });
}
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') return;
  console.error(err);
});

/* ------------------------------------------------------------------------- */
/* CLI                                                                       */
/* ------------------------------------------------------------------------- */

const program = new Command();
program
  .option('-p, --path <path>', 'The path to the skill')
  .option('-r, --remote <address>', 'Run as a remote simulation')
  .option('-t, --token <token>', 'Auth token for remote simulation')
  .option('-f, --frameless', 'Run with frameless window (no menu bar)')
  .allowUnknownOption(true)
  .parse(process.argv);

const cliOptions = program.opts();
const isRemote = typeof cliOptions.remote === 'string' && cliOptions.remote.length > 0;

if (!isRemote && !cliOptions.path) {
  console.error('You must specify a --path <skill-folder>');
  process.exit(1);
}

const skillPath = cliOptions.path
  ? path.resolve(cliOptions.path)
  : null;

/* ------------------------------------------------------------------------- */
/* Electron command-line switches                                            */
/* ------------------------------------------------------------------------- */

app.commandLine.appendSwitch('enable-speech-dispatcher');
// Be kind on dev Linux machines.
app.commandLine.appendSwitch('no-sandbox');
// Required because we run with nodeIntegration in renderer + webview.
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

/* ------------------------------------------------------------------------- */
/* Settings persistence                                                      */
/* ------------------------------------------------------------------------- */

const HOME_DIR = process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'];
const SETTINGS_PATH = path.join(HOME_DIR, '.jibo', 'simulator', 'settings.json');

const DEFAULT_SETTINGS = {
  contentWidth: 1280,
  contentHeight: 720,
  windowX: 50,
  windowY: 50,
  fullscreen: false,
  zoomFactorIndex: 4,
  zoomFactor: 1,
  viewMode: '3d',
  devToolsWindowX: 0,
  devToolsWindowY: 0,
  devToolsContentWidth: 1200,
  devToolsContentHeight: 800,
  isSimulatorDevToolsOpened: false,
  isDevToolsOpened: false,
  isBackgroundServiceDevToolsOpened: false,
  ttsMode: 'Instant'
};

const Settings = {
  _settings: Object.assign({}, DEFAULT_SETTINGS),
  _ready: false,
  _mainWindow: null,

  load() {
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
        this._settings = _.extend({}, DEFAULT_SETTINGS, JSON.parse(raw));
      }
    } catch (e) {
      console.warn('[settings] failed to read, using defaults:', e.message);
      this._settings = Object.assign({}, DEFAULT_SETTINGS);
    }
  },

  setMainWindow(win) { this._mainWindow = win; },
  setReady(b)        { this._ready = b; },

  get(key)           { return this._settings[key]; },
  all()              { return this._settings; },

  update(patch) {
    this._settings = _.extend({}, this._settings, patch);
    try {
      fse.ensureDirSync(path.dirname(SETTINGS_PATH));
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(this._settings, null, '    '), 'utf8');
    } catch (e) {
      console.warn('[settings] write failed:', e.message);
    }
    if (this._ready && this._mainWindow && !this._mainWindow.isDestroyed()) {
      this._mainWindow.webContents.send('simulator-settings-changed', JSON.stringify(this._settings));
    }
  }
};

Settings.load();

/* ------------------------------------------------------------------------- */
/* Windowing & menus                                                         */
/* ------------------------------------------------------------------------- */

const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
const DEFAULT_ZOOM_INDEX = 4;
const PHYSICAL_ZOOM_INDEX = -2;

const Windowing = {
  win: null,
  zoomIndex: DEFAULT_ZOOM_INDEX,
  zoom: 1,

  init() {
    this.zoomIndex = Settings.get('zoomFactorIndex');
    this.zoom = this.zoomIndex === PHYSICAL_ZOOM_INDEX ? 1 : ZOOM_LEVELS[this.zoomIndex];
  },

  setWindow(w) {
    this.win = w;
    globalShortcut.register('CmdOrCtrl+0', () => this.setZoom(DEFAULT_ZOOM_INDEX));
    this._dimensionInterval = setInterval(() => {
      if (!this.win || this.win.isDestroyed()) return;
      const [cw, ch] = this.win.getContentSize();
      const sf = this.getScaleFactor();
      const b = this.win.getBounds();
      const cur = Settings.all();
      if (cur.windowX !== b.x || cur.windowY !== b.y ||
          cur.contentWidth !== cw * sf || cur.contentHeight !== ch * sf ||
          cur.devicePixelRatio !== sf) {
        Settings.update({
          windowX: b.x, windowY: b.y,
          contentWidth: cw * sf, contentHeight: ch * sf,
          devicePixelRatio: sf
        });
      }
    }, 200);
  },

  shutdown() {
    if (this._dimensionInterval) {
      clearInterval(this._dimensionInterval);
      this._dimensionInterval = null;
    }
  },

  getZoom() { return this.zoom; },

  getDisplay() {
    if (this.win && !this.win.isDestroyed()) {
      return screen.getDisplayMatching(this.win.getBounds());
    }
    return screen.getDisplayMatching({
      x: Settings.get('windowX'),
      y: Settings.get('windowY'),
      width: Settings.get('contentWidth'),
      height: Settings.get('contentHeight')
    });
  },

  getScaleFactor() { return this.getDisplay().scaleFactor; },

  setZoom(idx) {
    if ((idx < 0 && idx !== PHYSICAL_ZOOM_INDEX) || idx >= ZOOM_LEVELS.length) return;
    this.zoomIndex = idx;
    if (idx === PHYSICAL_ZOOM_INDEX) {
      // Original used the lifesized package to compute physical pixels per inch
      // off the display's scaleFactor; we approximate as 1 (rare to care).
      this.zoom = 1;
    } else {
      this.zoom = ZOOM_LEVELS[idx];
    }
    const display = this.getDisplay();
    Settings.update({ zoomFactor: this.zoom / display.scaleFactor, zoomFactorIndex: idx });
  },

  reset() { this.setZoom(DEFAULT_ZOOM_INDEX); },

  getMenuItems() {
    return [
      {
        label: 'Toggle Full Screen',
        accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
        click: () => {
          if (!this.win) return;
          this.win.setFullScreen(!this.win.isFullScreen());
          Settings.update({ fullscreen: this.win.isFullScreen() });
        }
      },
      {
        label: 'Actual Size (100%)',
        accelerator: 'CmdOrCtrl+0',
        click: () => this.setZoom(DEFAULT_ZOOM_INDEX)
      },
      {
        label: 'Zoom In',
        accelerator: 'CmdOrCtrl+=',
        click: () => this.setZoom(this.zoomIndex === PHYSICAL_ZOOM_INDEX ? DEFAULT_ZOOM_INDEX : this.zoomIndex + 1)
      },
      {
        label: 'Zoom Out',
        accelerator: 'CmdOrCtrl+-',
        click: () => this.setZoom(this.zoomIndex === PHYSICAL_ZOOM_INDEX ? DEFAULT_ZOOM_INDEX : this.zoomIndex - 1)
      },
      {
        label: 'Physical Size',
        accelerator: 'CmdOrCtrl+4',
        click: () => this.setZoom(PHYSICAL_ZOOM_INDEX)
      },
      { type: 'separator' },
      {
        label: '2D View',
        accelerator: 'CmdOrCtrl+2',
        click: () => Settings.update({ viewMode: '2d' })
      },
      {
        label: '3D View',
        accelerator: 'CmdOrCtrl+3',
        click: () => Settings.update({ viewMode: '3d' })
      },
      { type: 'separator' }
    ];
  }
};

/* ------------------------------------------------------------------------- */
/* DevTools state                                                            */
/* ------------------------------------------------------------------------- */

const DevTools = {
  init(win) {
    this.win = win;
    if (Settings.get('isSimulatorDevToolsOpened')) {
      win.webContents.openDevTools();
    }
    win.webContents.on('devtools-opened', () => {
      Settings.update({ isSimulatorDevToolsOpened: true });
    });
    win.webContents.on('devtools-closed', () => {
      Settings.update({ isSimulatorDevToolsOpened: false });
    });
  },
  toggleSkillDevTools() {
    Settings.update({ isDevToolsOpened: !Settings.get('isDevToolsOpened') });
    if (Settings._ready && this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('toggle-dev-tools', Settings.get('isDevToolsOpened'));
    }
  },
  shutdown() {}
};

/* ------------------------------------------------------------------------- */
/* IPC                                                                       */
/* ------------------------------------------------------------------------- */

let registryHost;
let skillWebContents = null;

function resolveSkillEntryPath() {
  if (!skillPath) return null;
  let entry = path.join(skillPath, 'index.html');
  try {
    const pkgPath = path.join(skillPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.jibo && typeof pkg.jibo.main === 'string') {
        entry = path.resolve(skillPath, pkg.jibo.main);
      }
    }
  } catch (err) {
    console.warn('[ipc] resolveSkillEntryPath failed:', err.message);
  }
  return entry;
}

function setupIpc() {
  ipcMain.on('get-simulator-settings', (e) => {
    Settings.setReady(true);
    Settings.update({ zoomFactor: Windowing.getZoom() });
    e.returnValue = JSON.stringify(Settings.all());
  });

  ipcMain.on('is-remote-mode', (e) => {
    e.returnValue = isRemote.toString();
  });

  // Directory path — used by SSM skillsBaseDir (path.join(skillPath, "..")).
  ipcMain.on('get-skill-path', (e) => {
    e.returnValue = skillPath || '';
  });

  // file:// URL — used only for the skill webview src.
  ipcMain.on('get-skill-entry-url', (e) => {
    const entry = resolveSkillEntryPath();
    e.returnValue = entry ? 'file://' + entry : '';
  });

  ipcMain.on('get-background-service-path', (e) => {
    if (!skillPath) { e.returnValue = ''; return; }
    try {
      const root = findRoot(skillPath);
      const pkg = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf8'));
      if (pkg.jibo && typeof pkg.jibo.backgroundMain === 'string') {
        e.returnValue = path.resolve(root, pkg.jibo.backgroundMain);
      } else {
        e.returnValue = '';
      }
    } catch (err) {
      console.warn('[ipc] background-service-path failed:', err.message);
      e.returnValue = '';
    }
  });

  ipcMain.on('get-context', (e) => {
    const ctx = { registryHost, token: cliOptions.token };
    safeStdoutWrite(`[ipc] get-context from webContents#${e.sender.id} registryHost=${registryHost || '(unset)'}\n`);
    e.sender.send('set-context', ctx);
  });

  // Host renderer forwards webview sendToHost('get-context') here.
  ipcMain.on('get-context-forward', () => {
    const ctx = { registryHost, token: cliOptions.token };
    safeStdoutWrite(`[ipc] get-context-forward registryHost=${registryHost || '(unset)'}\n`);
    if (skillWebContents && !skillWebContents.isDestroyed()) {
      skillWebContents.send('set-context', ctx);
    }
  });

  ipcMain.on('registry-init', (e, host) => {
    registryHost = host;
  });

  ipcMain.on('set-tts-mode', (e, mode) => {
    Settings.update({ ttsMode: mode });
  });

  ipcMain.on('set-speaker-id', (e, id) => {
    Settings.update({ speakerId: id });
  });

  ipcMain.on('close-dev-tools', () => {
    Settings.update({ isDevToolsOpened: false });
  });

  ipcMain.on('close-background-service-dev-tools', () => {
    Settings.update({ isBackgroundServiceDevToolsOpened: false });
  });
}

/* ------------------------------------------------------------------------- */
/* Window creation                                                           */
/* ------------------------------------------------------------------------- */

function createMainWindow() {
  // chdir into the skill folder so PathUtils.findRoot() and require() resolve correctly.
  if (skillPath) {
    try { process.chdir(skillPath); } catch {}
  }

  const display = (() => {
    try {
      return screen.getDisplayMatching({
        x: Settings.get('windowX'),
        y: Settings.get('windowY'),
        width: Settings.get('contentWidth'),
        height: Settings.get('contentHeight')
      });
    } catch {
      return screen.getDisplayMatching({ x: 100, y: 100, width: 1000, height: 1000 });
    }
  })();

  const winOpts = {
    webPreferences: {
      partition: 'persist:jibo-simulator',
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      sandbox: false,
      webviewTag: true,
      // Allow loading file:// URLs from file:// pages without CORS hassle.
      webSecurity: false
    }
  };

  if (Settings.get('fullscreen')) {
    winOpts.fullscreen = true;
  } else {
    winOpts.useContentSize = true;
    winOpts.x = Settings.get('windowX');
    winOpts.y = Settings.get('windowY');
    winOpts.width = Math.round(Settings.get('contentWidth') / display.scaleFactor);
    winOpts.height = Math.round(Settings.get('contentHeight') / display.scaleFactor);
  }

  const win = new BrowserWindow(winOpts);

  // Forward renderer console messages to the main process stdout so we can see
  // them without opening DevTools manually (helpful while bringing this back up).
  win.webContents.on('console-message', (e, level, message, line, source) => {
    const lvl = ['DBG', 'INFO', 'WRN', 'ERR'][level] || `L${level}`;
    safeStdoutWrite(`[renderer ${lvl}] ${source}:${line}  ${message}\n`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    safeStdoutWrite(`[renderer GONE] reason=${details.reason} exitCode=${details.exitCode}\n`);
  });
  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    safeStdoutWrite(`[did-fail-load] ${errorCode} ${errorDescription} url=${validatedURL}\n`);
  });

  // Skill webview guest: forward sendToHost('get-context') and attach diagnostics.
  win.webContents.on('did-attach-webview', (_e, guestContents) => {
    skillWebContents = guestContents;
    guestContents.on('ipc-message', (_event, channel) => {
      if (channel === 'get-context') {
        const ctx = { registryHost, token: cliOptions.token };
        safeStdoutWrite(`[ipc] webview sendToHost get-context registryHost=${registryHost || '(unset)'}\n`);
        guestContents.send('set-context', ctx);
      }
    });
    guestContents.on('console-message', (_e, level, message, line, sourceId) => {
      const lvl = ['DBG', 'INFO', 'WRN', 'ERR'][level] || `L${level}`;
      safeStdoutWrite(`[webview ${lvl}] ${sourceId}:${line}  ${message}\n`);
    });
    guestContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
      safeStdoutWrite(`[webview did-fail-load] ${errorCode} ${errorDescription} url=${validatedURL}\n`);
    });
    guestContents.on('did-finish-load', () => {
      safeStdoutWrite(`[webview ok] ${guestContents.getURL()}\n`);
    });
  });

  DevTools.init(win);

  const accel = process.platform === 'darwin' ? 'Alt+Command+J' : 'Shift+Control+J';
  globalShortcut.register(accel, () => {
    if (win && !win.isDestroyed()) win.webContents.toggleDevTools();
  });

  Windowing.setWindow(win);
  Settings.setMainWindow(win);

  win.loadURL('file://' + path.join(__dirname, 'index.html'));

  win.on('closed', () => {
    Windowing.shutdown();
    DevTools.shutdown();
  });

  return win;
}

/* ------------------------------------------------------------------------- */
/* Application menu                                                          */
/* ------------------------------------------------------------------------- */

function buildAppMenu(win) {
  const editSubmenu = [
    { role: 'undo' }, { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
    { role: 'selectAll' }
  ];

  const viewSubmenu = [
    {
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: () => { if (win && !win.isDestroyed()) win.webContents.send('reload-skill'); }
    },
    { type: 'separator' }
  ].concat(Windowing.getMenuItems()).concat([
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Shift+Control+I',
          click: () => { if (win && !win.isDestroyed()) DevTools.toggleSkillDevTools(); }
        },
        {
          label: 'Simulator Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+J' : 'Shift+Control+J',
          click: () => { if (win && !win.isDestroyed()) win.webContents.toggleDevTools(); }
        }
      ]
    }
  ]);

  const template = [
    {
      label: app.name,
      submenu: [
        { label: 'Quit', accelerator: 'CommandOrControl+Q', click: () => app.quit() }
      ]
    },
    { label: 'Edit', submenu: editSubmenu },
    { label: 'View', submenu: viewSubmenu }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------------- */
/* Single-instance + lifecycle                                               */
/* ------------------------------------------------------------------------- */

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.on('ready', () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: app.name, submenu: [{ role: 'quit' }] }
    ]));
    const dlg = new BrowserWindow({
      useContentSize: true, width: 400, height: 200, resizable: false,
      webPreferences: { contextIsolation: false }
    });
    dlg.loadURL('file://' + path.join(__dirname, 'single-instance-dialog.html'));
  });
} else {
  app.on('second-instance', () => { /* noop \u2014 keep current instance */ });

  app.on('window-all-closed', () => app.quit());

  app.on('ready', () => {
    setupIpc();
    Windowing.init();
    const win = createMainWindow();
    buildAppMenu(win);
  });

  app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch {} });
}

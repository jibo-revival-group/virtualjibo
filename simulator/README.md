# Jibo Simulator (modernized)

Electron-based simulator for running Jibo skills locally. This is a modernization of the original `jibo-cli` simulator (Electron 1.4.3, 2017) to run on **Electron 30+** with **Skills Service Manager 14.2.9** and the **@be/be** skill from [../stuff/](../stuff/).

## Prerequisites

- Node.js 18+ (tested on Node 22)
- Linux with a display (`DISPLAY` set) or X11 forwarding
- The [../stuff/](../stuff/) folder populated with Jibo SDK packages (see below)

## Quick start

```bash
cd simulator
npm install          # installs Electron + public deps, runs setup.js
npm run be           # launch with @be/be skill
```

Or point at any built skill folder:

```bash
npm start -- --path /absolute/path/to/your/skill
```

## What `npm install` does

1. Installs public npm dependencies (Electron, React 0.13, lodash, etc.)
2. Runs [setup.js](setup.js), which:
   - Copies/links Jibo packages from [../stuff/](../stuff/) into `node_modules/`
   - Symlinks private deps from [../stuff/@be/be/node_modules/](../stuff/@be/be/node_modules/)
   - Installs compatibility shims ([shim/](shim/))
   - Patches a few bundled files for modern Electron (WebSocket URL handling, etc.)

If `skills-service-manager` fails to load after install:

```bash
node discover-deps.js   # auto-installs missing public npm deps and re-runs setup
```

## Required `stuff/` layout

Minimum packages (already in this repo's `stuff/`):

| Path | Purpose |
|------|---------|
| `stuff/skills-service-manager-14.2.9/` | SSM 14 (real package, copied as `skills-service-manager-real`) |
| `stuff/@be/be/` | Built Be skill (with its own `node_modules/`) |
| `stuff/animation-utilities-6.0.3/` | 3D robot renderer |
| `stuff/jibo-client-framework-5.0.3/` | HTTP/WS client framework |
| `stuff/jibo-service-framework-5.0.3/` | HTTP/WS service framework |
| `stuff/jibo-kb-9.0.3/` | Knowledge base |
| `stuff/jibo-sync-6.0.3/` | Sync utilities |
| `stuff/jibo-attention-manager-7.0.3/` | SSM dependency |
| `stuff/jibo-dof-arbiter-5.0.3/` | SSM dependency |
| `stuff/rule-generator-6.0.3/` | SSM dependency |
| `stuff/parser-download-3.0.0/` | Installed as `@jibo/parser-download` |
| `stuff/jibo-server-client-3.0.117/` | Jibo cloud API client |
| `stuff/@jibo/` | `@jibo/three`, `interfaces`, `jetstream-client`, etc. |

**Not required:** `@jibo/hub-client` — a no-op stub is provided in [shim/@jibo/hub-client/](shim/@jibo/hub-client/).

## Architecture

```
Electron main (main.js)
  └── Simulator renderer (index.html + client.js)
        ├── skills-service-manager shim → SSM 14 Factory (in-process services)
        ├── 3D Jibo robot (animation-utilities + Three.js)
        ├── Chat / LPS sidebar (React 0.13)
        └── <webview> → your skill (e.g. @be/be/index.html)
              └── require('jibo') from skill's node_modules
```

SSM 14 bootstraps ~30 simulated services (TTS, ASR/Jetstream, Body, LPS, KB, Media, etc.) on random local ports and registers them via a local RegistryService. The skill webview connects to those services through the registry.

## Compatibility shims

[shim/skills-service-manager/](shim/skills-service-manager/) wraps SSM 14 to match the API that the bundled `client.js` (from jibo-cli 5.3.9) expects from SSM 10:

- Stubs dropped services: `ASRService`, `ListenService`, `NLUService`, `GlobalListen`
- Renames `SkillsServiceSim` → `SkillsService`
- Filters the Factory config to only pass services SSM 14 understands

The simulator's chat input (type-to-speak) uses the stubbed ASR path and may not drive real speech recognition. The **Be skill itself** talks to SSM 14 via `jibo-service-clients` and is unaffected.

## Linux sandbox note

Electron's setuid sandbox often fails on dev Linux installs. The npm scripts pass `--no-sandbox` and `ELECTRON_DISABLE_SANDBOX=1`. If launch still fails with a `chrome-sandbox` error, run:

```bash
ELECTRON_DISABLE_SANDBOX=1 ./node_modules/.bin/electron . --no-sandbox --path ../stuff/@be/be
```

## Expected warnings (offline / no robot credentials)

When running without Jibo cloud credentials or network access to `alpha-entrypoint.jibo.com`, you will see non-fatal errors such as:

- `getaddrinfo ENOTFOUND alpha-entrypoint.jibo.com` — KB sync can't reach Jibo cloud
- `This robot does not have a loop!` — no enrolled user loop in local KB cache
- `Cannot find module '/opt/jibo/Jibo/Skills/...'` — on-robot paths hardcoded in analytics
- `Cannot POST /screen` — body service screen route mismatch (cosmetic)

These do **not** prevent the simulator window, 3D robot, and skill webview from loading. Cloud-dependent features (sync, chitchat via hub, etc.) won't work offline.

## Menu shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+R | Reload skill |
| Ctrl+2 / Ctrl+3 | 2D / 3D view |
| Ctrl+0 | Actual size (100%) |
| Ctrl+= / Ctrl+- | Zoom in / out |
| Shift+Ctrl+J | Simulator devtools |
| Shift+Ctrl+I | Skill webview devtools |

Settings persist to `~/.jibo/simulator/settings.json`.

## Files

| File | Role |
|------|------|
| [main.js](main.js) | Modern Electron main process (replaces minified `app.js`) |
| [client.js](client.js) | Original bundled simulator renderer (unchanged) |
| [index.html](index.html) | Simulator UI shell + skill webview |
| [setup.js](setup.js) | Post-install linker/copier for Jibo packages |
| [discover-deps.js](discover-deps.js) | Iteratively resolve missing npm deps for SSM |
| [shim/](shim/) | SSM 14 compat layer + hub-client stub |

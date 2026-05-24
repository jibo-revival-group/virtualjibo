#!/usr/bin/env node
/**
 * Repeatedly try to load skills-service-manager. Each time it fails with
 * MODULE_NOT_FOUND, install the missing module (only if it's a public-npm
 * dep) and try again. Re-runs setup.js after each install to restore symlinks
 * that npm may have wiped out.
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const MAX_ATTEMPTS = 80;
const SIM_DIR = __dirname;

// Things that LIVE IN STUFF/ or be's node_modules \u2014 never npm-install these.
const PRIVATE = new Set([
  'skills-service-manager', 'skills-service-manager-real',
  'animation-utilities', 'jibo-client-framework', 'jibo-kb',
  'jibo-service-framework', 'jibo-sync', 'jibo-log', 'jibo-attention-manager',
  'jibo-dof-arbiter', 'rule-generator', 'jibo-server-client',
  'jibo-cai-utils', 'jibo-common-types', 'jibo-expression-client',
  'jibo-service-clients', 'jibo-state-machine', 'jibo-typed-events',
  'jibo-node-xml', 'jibo-action-system', 'jibo-anim-db-animations',
  'jibo-anim-db', 'jibo-loader', 'jibo-flow-core', 'jibo-emotion-system',
  'jibo-embodied-dialog', 'jibo-data-utils', 'jibo-keyframes',
  'jibo-plugins', 'jibo-tunable', 'jibo-tbd', 'jibo-radio',
  'jibo-cai-persistence', 'jibo-cai-singleton', 'jibo-command-protocol',
  'jibo-command-library', 'jibo-eventemitter3', 'jibo-interaction-memory',
  'application-metrics', 'jibo-singletons', 'jibo-sync-stage',
  '@jibo/three', '@jibo/analytics-node', '@jibo/interfaces',
  '@jibo/jetstream-client', '@jibo/jibo-server-client', '@jibo/ws',
  '@jibo/chitchat-mims', '@jibo/parser-download', '@jibo/hub-client'
]);

function attemptLoad() {
  const r = spawnSync(process.execPath, [
    '-e',
    "try{require('skills-service-manager');console.log('__SSM_LOADED__');}catch(e){console.error('__LOAD_FAIL__:', e.code, e.message);process.exit(1);}"
  ], { cwd: SIM_DIR, encoding: 'utf8' });
  const out = (r.stderr || '') + (r.stdout || '');
  if (out.includes('__SSM_LOADED__')) return { ok: true };
  return { ok: false, err: out };
}

function runSetup() {
  const r = spawnSync(process.execPath, ['setup.js'], { cwd: SIM_DIR, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('[discover] setup.js failed:', r.stderr);
    return false;
  }
  return true;
}

function installModule(name) {
  console.log(`[discover] npm install ${name}`);
  const r = spawnSync('npm', [
    'install', '--no-audit', '--no-fund', '--ignore-scripts',
    '--loglevel=error', '--save', name
  ], { cwd: SIM_DIR, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('[discover] npm install failed:', r.stderr);
    return false;
  }
  return runSetup(); // restore symlinks npm may have removed
}

const failedTwice = new Set();
let lastFailed = null;

for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
  const out = attemptLoad();
  if (out.ok) {
    console.log('[discover] skills-service-manager loaded cleanly!');
    process.exit(0);
  }
  const m = out.err.match(/Cannot find module ['"]([^'"]+)['"]/);
  if (!m) {
    console.error('[discover] non-MODULE_NOT_FOUND error:');
    console.error(out.err.slice(-3000));
    process.exit(1);
  }
  const missing = m[1];
  // npm needs the package name only (no subpaths)
  const pkgName = missing.startsWith('@')
    ? missing.split('/').slice(0, 2).join('/')
    : missing.split('/')[0];

  if (PRIVATE.has(pkgName)) {
    console.error(`[discover] missing PRIVATE module "${missing}". Cannot npm-install. Check setup.js targets and stuff/.`);
    console.error(out.err.slice(-2000));
    process.exit(2);
  }

  if (missing === lastFailed) failedTwice.add(missing);
  if (failedTwice.has(missing)) {
    console.error(`[discover] module "${missing}" still missing after install \u2014 cannot proceed.`);
    console.error(out.err.slice(-2000));
    process.exit(3);
  }
  lastFailed = missing;
  if (!installModule(pkgName)) process.exit(4);
}

console.error('[discover] gave up after', MAX_ATTEMPTS, 'attempts');
process.exit(5);

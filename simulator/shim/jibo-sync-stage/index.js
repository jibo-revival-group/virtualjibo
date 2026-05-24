'use strict';

class SyncStage {
  constructor() {}
  init(cb) { if (typeof cb === 'function') process.nextTick(cb); return Promise.resolve(); }
  start() { return Promise.resolve(); }
  stop() { return Promise.resolve(); }
  on() { return this; }
  once() { return this; }
  off() { return this; }
  emit() { return false; }
}

module.exports = { SyncStage, default: SyncStage };

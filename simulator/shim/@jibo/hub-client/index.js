/**
 * Simulator mock for @jibo/hub-client.
 *
 * The real @jibo/hub-client@^1.0.23 is not available in stuff/. SSM 14's
 * JetstreamServiceSim calls Client.startListenSession() during speech turns.
 * This mock completes those turns locally so typed chat can reach Be.
 */

'use strict';

const { EventEmitter } = require('events');

let sessionCounter = 0;

function matchLaunch(text, rules) {
  if (!rules || rules.indexOf('launch') < 0) return null;

  if (/\b(open|show|load|display|bring up|return to)\b.*\bmenu\b|\bmain menu\b/.test(text)) {
    return {
      skillID: '@be/main-menu',
      launch: true,
      onRobot: true
    };
  }
  if (/\b(stop|sleep|shut up|be quiet)\b/.test(text)) {
    return {
      skillID: '@be/idle',
      launch: true,
      onRobot: true
    };
  }
  return null;
}

function buildListenPayload(text, listenOptions, nluOverride) {
  const rules = (listenOptions && listenOptions.rules) || [];
  const nlu = nluOverride || {
    rules,
    intent: '',
    entities: {}
  };
  const match = matchLaunch(text, rules);
  if (match) {
    nlu.intent = nlu.intent || 'launch';
  }
  return {
    asr: { text, confidence: 1 },
    nlu,
    match: match || undefined
  };
}

class MockListenSession {
  constructor(listenOptions) {
    this.transactionID = `sim-${Date.now()}-${++sessionCounter}`;
    this.events = new EventEmitter();
    this.events.setMaxListeners(0);
    this.listenOptions = listenOptions || {};
    this.transactionDone = Promise.resolve();
  }

  writeContext() {}

  close() {
    return Promise.resolve();
  }

  _emitListen(data) {
    this.transactionDone = new Promise((resolve) => {
      process.nextTick(() => {
        this.events.emit('LISTEN', data);
        resolve();
      });
    });
    return this.transactionDone;
  }

  writeClientASR(text) {
    return this._emitListen(buildListenPayload(text, this.listenOptions));
  }

  writeClientNLU(nlu) {
    const text = (nlu && nlu.intent) ? String(nlu.intent) : '';
    return this._emitListen(buildListenPayload(text, this.listenOptions, nlu));
  }
}

class MockProactiveSession {
  constructor() {
    this.transactionID = `proactive-${Date.now()}-${++sessionCounter}`;
    this.events = new EventEmitter();
    this.events.setMaxListeners(0);
    this.transactionDone = Promise.resolve();
  }
  writeContext() {}
  close() { return Promise.resolve(); }
}

class HubClient extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }
  init(opts, cb) {
    if (typeof cb === 'function') process.nextTick(() => cb());
    return Promise.resolve();
  }
  close() {}
  send() { return Promise.resolve(null); }
  request() { return Promise.resolve(null); }

  static startListenSession(hubOptions, listenOptions) {
    return Promise.resolve(new MockListenSession(listenOptions));
  }

  static startProactiveSession(hubOptions, body) {
    return Promise.resolve(new MockProactiveSession());
  }
}

const stub = new HubClient();

function noopFn() { return stub; }

module.exports = {
  default: HubClient,
  HubClient,
  Client: HubClient,
  createInstance: noopFn,
  getInstance: noopFn,
  instance: stub
};

/**
 * Compatibility shim: presents skills-service-manager@14.2.9 with the API surface
 * that simulator/client.js (bundled against SSM 10.3.5) expects.
 *
 * SSM 14 dropped: ASRService, ListenService, NLUService, RuleManager, GlobalListen,
 *                 ASRLoopInformer
 * SSM 14 renamed: SkillsServiceSim -> SkillsService
 * SSM 14 added:   JetstreamServiceSim (subsumes the ASR+Jetstream cloud client path)
 *
 * Strategy:
 *  - Re-export everything SSM 14 provides at the top level.
 *  - Alias SkillsServiceSim -> SkillsService.
 *  - Provide null-stub classes for the dropped services. Their `.instance` is an
 *    EventEmitter with no-op methods so the simulator's chat/LPS panel doesn't crash.
 *  - Wrap Factory so the simulator's old service-list (with ASRService, NLUService,
 *    SystemManagerService, ServerService, etc.) is filtered/translated before being
 *    handed to the real SSM 14 Factory.
 */

'use strict';

const { EventEmitter } = require('events');

// The real SSM 14 was hard-copied into simulator/node_modules/skills-service-manager-real/
// by setup.js, where it can resolve its public-npm transitive deps from
// simulator/node_modules/.
const real = require('skills-service-manager-real');

/* ------------------------------------------------------------------------- */
/* Stub class factory                                                        */
/* ------------------------------------------------------------------------- */

function makeStubServiceClass(name) {
  class Stub extends EventEmitter {
    constructor() {
      super();
      this.setMaxListeners(0);
    }
    static createInstance(conf, rootDir) {
      if (!Stub._instance) Stub._instance = new Stub();
      return Stub._instance;
    }
    static get instance() {
      if (!Stub._instance) Stub._instance = new Stub();
      return Stub._instance;
    }
    init(cb) {
      console.warn(`[ssm-shim] ${name}.init() called \u2014 service is stubbed (no-op)`);
      if (typeof cb === 'function') process.nextTick(() => cb());
    }
    // Common methods the simulator's client.js calls on these instances:
    onWordsReceived() {}
    triggerAudioEvent() {}
    triggerAudioEventEnd() {}
    triggerSimulatedHJEvent() {}
    updateTarget() {}
    removeEntity() {}
    setTargetId() {}
    getEntities() { return []; }
    setMode() {}
  }
  Object.defineProperty(Stub, 'name', { value: name });
  return Stub;
}

// ASRService forwards typed chat to JetstreamServiceSim (SSM 14's ASR path).
class ASRService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }
  static createInstance(conf, rootDir) {
    if (!ASRService._instance) ASRService._instance = new ASRService();
    return ASRService._instance;
  }
  static get instance() {
    if (!ASRService._instance) ASRService._instance = new ASRService();
    return ASRService._instance;
  }
  init(cb) {
    if (typeof cb === 'function') process.nextTick(() => cb());
  }
  onWordsReceived(speech) {
    const jetstream = real.JetstreamServiceSim && real.JetstreamServiceSim.instance;
    if (!jetstream) {
      console.warn('[ssm-shim] ASRService.onWordsReceived: JetstreamServiceSim not ready');
      return;
    }
    if (!speech || typeof speech.words !== 'string') return;

    let words = speech.words.toLowerCase().trim().replace(/[\|&;\$%@"#<>\(\)\+,?.]/g, '');
    const payload = Object.assign({}, speech, { words });

    const state = jetstream.state;
    const containsHJ = words.indexOf('hey jibo') >= 0;
    const isIdle = state === 'IDLE';

    if (speech.final && !containsHJ && isIdle) {
      jetstream.onWordsReceived({
        words: 'hey jibo',
        final: false,
        speaker: speech.speaker,
        speakerId: speech.speakerId
      });
      words = 'hey jibo ' + words;
      jetstream.onWordsReceived(Object.assign({}, payload, { words, final: true }));
      return;
    }

    jetstream.onWordsReceived(Object.assign({}, payload, { words }));
  }
}
Object.defineProperty(ASRService, 'name', { value: 'ASRService' });
const ListenService = makeStubServiceClass('ListenService');
const NLUService = makeStubServiceClass('NLUService');
const RuleManager = makeStubServiceClass('RuleManager');
const ASRLoopInformer = makeStubServiceClass('ASRLoopInformer');

// GlobalListen has a different shape \u2014 it's a singleton with an events bus.
class GlobalListenStub {
  constructor() {
    this.events = {
      listen: {
        hjHeard: { on: () => {}, off: () => {} },
        wordsHeard: { on: () => {}, off: () => {} }
      }
    };
  }
  static getInstance() {
    if (!GlobalListenStub._inst) GlobalListenStub._inst = new GlobalListenStub();
    return GlobalListenStub._inst;
  }
}

/* ------------------------------------------------------------------------- */
/* Factory wrapper                                                           */
/* ------------------------------------------------------------------------- */

// Service names that SSM 14 actually knows how to construct (verified via the
// orchestrator task list it builds). Anything in here is passed through to the
// real Factory.
const SSM14_KNOWN_SERVICES = new Set([
  'TTSService', 'LPSService', 'BodyService', 'NotificationsService',
  'JetstreamServiceSim', 'SkillsService', 'GlobalManagerService',
  'MediaService', 'MediaManagerService', 'KBService', 'WifiService',
  'SchedulerService', 'ErrorService', 'SecureTransferServiceSim',
  'SecurityControllerService', 'ExpressionService', 'RemoteService',
  'SystemManagerService', 'SystemMonitoringServiceSim', 'ServerService',
  'AudioServiceSim', 'PerformanceServiceSim'
]);

// Renames from SSM 10 names \u2192 SSM 14 names.
const SERVICE_RENAMES = {
  SkillsServiceSim: 'SkillsService'
};

// SSM 10 names that SSM 14 dropped \u2014 we just skip these.
const DROPPED_SERVICES = new Set([
  'ASRService', 'ListenService', 'NLUService'
]);

class FactoryShim {
  constructor(conf, rootDir) {
    const inServices = (conf && conf.services) || {};
    const outServices = {};
    for (const name of Object.keys(inServices)) {
      const mapped = SERVICE_RENAMES[name] || name;
      if (DROPPED_SERVICES.has(name)) {
        console.warn(`[ssm-shim] Dropping unsupported service "${name}" (not in SSM 14)`);
        continue;
      }
      if (!SSM14_KNOWN_SERVICES.has(mapped)) {
        console.warn(`[ssm-shim] Skipping unknown service "${name}" \u2192 "${mapped}"`);
        continue;
      }
      outServices[mapped] = inServices[name];
    }
    // The simulator asks for ASRService; SSM 14 fulfils that role with
    // JetstreamServiceSim. Wire the ASR port request over to it if not already set.
    if (inServices.ASRService && !outServices.JetstreamServiceSim) {
      outServices.JetstreamServiceSim = inServices.ASRService;
    }
    const newConf = Object.assign({}, conf, { services: outServices });
    this._real = new real.Factory(newConf, rootDir);
  }
  init(cb) { return this._real.init(cb); }
}

/* ------------------------------------------------------------------------- */
/* Compose the shim's default export                                         */
/* ------------------------------------------------------------------------- */

const compatExports = Object.assign({}, real, {
  Factory: FactoryShim,
  ASRService,
  ListenService,
  NLUService,
  RuleManager,
  ASRLoopInformer,
  GlobalListen: GlobalListenStub,
  // Alias for code that still references the old name:
  SkillsServiceSim: real.SkillsService
});

module.exports = compatExports;
module.exports.default = compatExports;

'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; }; // the one true minilog instance

var _findRoot = require('find-root');

var _findRoot2 = _interopRequireDefault(_findRoot);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _minilog = require('minilog');

var _minilog2 = _interopRequireDefault(_minilog);

var _uncaughtUnhandled = require('./uncaught-unhandled');

var _fileBackend = require('./file-backend');

var _fileBackend2 = _interopRequireDefault(_fileBackend);

var _syslogBackend = require('./syslog-backend');

var _syslogBackend2 = _interopRequireDefault(_syslogBackend);

var _cloudBackend = require('./cloud-backend');

var _cloudBackend2 = _interopRequireDefault(_cloudBackend);

var _jiboSingletons = require('jibo-singletons');

var _jiboSingletons2 = _interopRequireDefault(_jiboSingletons);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let defaultLogDir = null;

//Minilog.enable();  // this is what you would normally do, it sets up the defaults
// instead we are going to tweak things a bit
// reference http://mixu.net/minilog/filter.html
if (_minilog2.default.defaultFormatter) {
    _minilog2.default.pipe(_minilog2.default.suggest.deny(/.*/, 'info')) // suppress messages < 'info' (no debug)
    .pipe(_minilog2.default.defaultFormatter).pipe(_minilog2.default.defaultBackend);
} else {
    _minilog2.default.pipe(_minilog2.default.suggest.deny(/.*/, 'info')) // suppress messages < 'info' (no debug)
    .pipe(_minilog2.default.defaultBackend);
}

class JiboLog {
    constructor(name) {
        this.name = name || '[unknown module]';
        if (name && name.indexOf('/') === 0) {
            // should this perhaps be path.isAbsolute? FIXME
            this.origname = name;
            this.name = _path2.default.basename(name);
        }
        this.minilog = (0, _minilog2.default)(this.name);
        this.handleUncaughtAndUnhandled();
    }

    log() {
        this.minilog.log.apply(_minilog2.default, arguments); // alias for debug
    }
    debug() {
        this.minilog.debug.apply(_minilog2.default, arguments);
    }
    info() {
        this.minilog.info.apply(_minilog2.default, arguments);
    }
    warn() {
        this.minilog.warn.apply(_minilog2.default, arguments);
    }
    error() {
        this.minilog.error.apply(_minilog2.default, arguments);
    }

    // our own additions
    iferr(err) {
        if (err) {
            for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
            }

            // // not using [].slice here for performance reasons
            // // see section 3.2 https://github.com/petkaantonov/bluebird/wiki/Optimization-killers
            // let args = new Array(arguments.length);
            // for (let i=0; i < args.length; ++i) {
            //     args[i] = arguments[i];  // i must always be valid for arguments object
            // }

            // converted the above to use the ES6 ... operator instead
            args.push(err); // put the error object on the end
            this.minilog.error.apply(_minilog2.default, args);
        }
    }

    handleUncaughtAndUnhandled() {
        var _this = this;

        if ((typeof process === 'undefined' ? 'undefined' : _typeof(process)) === 'object') {
            // only when running under node

            // log uncaughtExceptions
            process.on('uncaughtException', function (err) {
                (0, _uncaughtUnhandled.logUncaught)(_this.minilog, err);
            });

            // log any 'uncaught', otherwise silent, promise exceptions.
            process.on('unhandledRejection', function (reason, p) {
                (0, _uncaughtUnhandled.logUnhandled)(_this.minilog, reason, p);
            });
        }
    }

    enableDebug(name) {
        let level = arguments.length <= 1 || arguments[1] === undefined ? 'debug' : arguments[1];

        name = name || this.name;
        _minilog2.default.suggest.allow(name, level);
    }

    toFile() {
        let filename = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
        let callback = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

        // note: we might be logging to multiple files (so can't use this.fileBackend)
        let fileBackend = new _fileBackend2.default(filename, defaultLogDir);
        fileBackend.init(function () {
            _minilog2.default.pipe(fileBackend);
            if (callback) {
                callback();
            }
        });
    }
    setDefaultLogDir(directory, callback) {
        defaultLogDir = directory;
        if (callback) {
            // for backwards compatibility
            setImmediate(callback);
        }
    }

    toSyslog() {
        if (!this.syslogBackend) {
            this.syslogBackend = new _syslogBackend2.default();
            _minilog2.default.pipe(this.syslogBackend);
        }
    }

    toCloud(minBatchSize, maxBatchSize, idleUploadTimeout) {
        if (!this.cloudBackend) {
            this.cloudBackend = new _cloudBackend2.default(minBatchSize, maxBatchSize, idleUploadTimeout);
            _minilog2.default.pipe(this.cloudBackend);
        }
    }
    toCloudConnect(accessKey, region, jiboId, callback) {
        if (this.cloudBackend) {
            this.cloudBackend.connect(accessKey, region, jiboId, callback);
        }
    }
    toCloudDisable() {
        if (this.cloudBackend) {
            this.cloudBackend.disable();
        }
    }

    static version() {
        let rootPath = (0, _findRoot2.default)(module.filename);
        return require(_path2.default.resolve(rootPath, 'package.json')).version;
    }

}

// we want to insure there is only ever one instance of the JiboLog module
// because of the file scope variables and especially the Minilog instance
exports.default = _jiboSingletons2.default.enforceSingleton(JiboLog, 'JiboLog');

// at one point I tried to auto-derive the name using this technique:
// http://stackoverflow.com/questions/13227489/how-can-one-get-the-file-path-of-the-caller-function-in-node-js
// but that failed (the stack objects were empty), and it seemed too brittle
// I even gave this promising looking module a try:
// https://www.npmjs.com/package/caller-id
// but it uses the same technique and fails under electron
// (but only when running in a window oddly, works in the very top-level .js file)
// note that minilog even has a 'formatWithStack' formatter option, but it uses the same method
// so is likely not going to work in electron either.
//# sourceMappingURL=map/main.js.map

'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _syslogClient = require('syslog-client');

var _syslogClient2 = _interopRequireDefault(_syslogClient);

var _formatHelper = require('./format-helper');

var _formatHelper2 = _interopRequireDefault(_formatHelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const syslogInfo = {
    port: 514,
    target: "127.0.0.1"
};

class SyslogBackend extends _events2.default {
    // gets original arguments
    constructor() {
        super();
        this.client = undefined;
        this.enabled = false;

        if (process.platform === 'linux' && process.arch === 'arm') {
            this.enabled = true;
        } else {
            this.enabled = false; // don't bother on anything other than our linux/arm environment
        }

        // if we are turning on syslogging and there isn't a client, then start the client
        if (this.enabled && !this.syslogClient) {
            let options = {
                port: syslogInfo.port,
                transport: _syslogClient2.default.Transport.Udp
            };
            this.client = _syslogClient2.default.createClient(syslogInfo.target, options);

            this.client.on("error", function (error) {
                console.error(error);
            });
        }

        // if we are turning off syslogging and there currently is a client, then close the client
        if (!this.enabled && this.client) {
            this.client.close();
            this.client = undefined;
        }
    }

    write(name, level, args) {
        // EventEmitter
        if (this.enabled && this.client) {

            let type = undefined;
            switch (level) {
                case 'log':
                case 'debug':
                    {
                        type = "Debug";
                        break;
                    }
                case 'warn':
                    {
                        type = "Warning";
                        break;
                    }
                case 'error':
                    {
                        type = "Error";
                        break;
                    }
                case 'info':
                default:
                    {
                        type = "Informational";
                        break;
                    }
            }

            let logOptions = {
                facility: _syslogClient2.default.Facility.Local0,
                severity: _syslogClient2.default.Severity[type]
            };

            let msg = (0, _formatHelper2.default)(args);

            this.client.log(`${ name }: [${ level }] ${ msg }`, logOptions, function (error) {
                if (error) {
                    console.error(error);
                }
            });
        }
    }
}

exports.default = SyslogBackend;
//# sourceMappingURL=map/syslog-backend.js.map

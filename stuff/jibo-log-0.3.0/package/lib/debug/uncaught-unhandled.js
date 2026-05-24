'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.logUncaught = logUncaught;
exports.logUnhandled = logUnhandled;

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _formatHelper = require('./format-helper');

var _formatHelper2 = _interopRequireDefault(_formatHelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function logUncaught(minilog, err) {
    minilog.error('Uncaught', err);
    let msg = (0, _formatHelper2.default)([err]); // hopefully add useful stack traces to uncaught exceptions
    minilog.error(msg);

    // // flush or close logging files? FIXME
    // Minilog.end()  // or:
    // Object.keys(loggingToFiles).forEach( (filename) => {
    //     let pipe = loggingToFiles[filename];
    //     //Minilog.unpipe(pipe);  // hoping unhooking pipe will flush file (nope!)
    //     //Minilog.pipe(pipe);  // hoping i can then reattach pipe
    // });

    // will also need to flush logging to cloud here FIXME

    // if nobody else is listening for uncaught exceptions,
    // then re-throw the error, which should cause the process to exit
    let count = _events2.default.listenerCount(process, 'uncaughtException');
    let otherListeners = count - 1; // account for ourself
    if (otherListeners < 1) {
        // // but first let's actually close the logging files FIXME
        // let somePipe = loggingToFiles[Object.keys(loggingToFiles)[0]];
        // somePipe.on('end', () => {  // doesn't guarantee that all logs files will finish FIXME
        //     console.error(err);
        //     process.exit(1);
        // });
        // Minilog.end();

        // Object.keys(loggingToFiles).forEach( (filename) => {
        //     let pipe = loggingToFiles[filename];
        //     //Minilog.unpipe(pipe);  // hoping unhooking pipe will flush file (nope!)
        //     //Minilog.pipe(pipe);  // hoping i can then reattach pipe
        // });

        // amazingly this does not seem to cause a loop:
        //throw(err);

        //setTimeout( () => { throw(err); }, 0);  // ahh! but this does

        //process.nextTick(() => { throw(err); });  // as does this

        // // gaahhh!! i give up for now. things that exit on uncaughtExceptions will
        // // not have that error in the log files. FIXME
        // throw(err);

        if (process.versions.electron) {
            // we don't want to exit if we are running under electron
            // (even though we probably should eventually)
            // we might also want to do:
            //debugger;
            console.error(err);
        } else {
            setTimeout(function () {
                // ok, let's do it the hard way
                console.error(err);
                process.exit(1);
            }, 100); // ugly. probably won't always work. FIXME
        }
    }
}
//import stackTrace from 'stack-trace';


function logUnhandled(minilog, reason, p) {
    minilog.log('Unhandled Rejection at: Promise ', p, ' reason: ', reason);
    // we should probably do all the process exit logic that logUncaughtException does FIXME
}
//# sourceMappingURL=map/uncaught-unhandled.js.map

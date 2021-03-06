var EventEmitter = require('./ee').EventEmitter,
    util = require('util'),
    async = require('async'),
    config = require('./config'),
    common = require('./common'),
    exception = require('./exception'),
    transports = require('./transports');
Stream = require('stream').Stream;

var formatRegExp = /%[sdj%]/;

var xxx = function xxx(s) {     // internal dev/debug logging
    var args = ['XX' + 'X: ' + s].concat(
        Array.prototype.slice.call(arguments, 1));
    console.error.apply(this, args);
};
var _xxx = function xxx() {
};

xxx = _xxx; // comment out to turn on debug logging

//
// ### function Logger (options)
// #### @options {Object} Options for this instance.
// Constructor function for the Logger object responsible
// for persisting log messages and metadata to one or more transports.
//
var Logger = exports.Logger = function (options, _childOptions, _childSimple) {
    xxx('Logger start:', options)
    if (!(this instanceof Logger)) {
        return new Logger(options, _childOptions);
    }

    // Input arg validation.
    var parent;
    if (_childOptions !== undefined) {
        parent = options;
        options = _childOptions;
        if (!(parent instanceof Logger)) {
            throw new TypeError(
                'invalid Logger creation: do not pass a second arg');
        }
    }

    options = options || {};

    EventEmitter.call(this);

    // Fast path for simple child creation.
    if (parent && _childSimple) {
        // `_isSimpleChild` is a signal to stream close handling that this child
        // owns none of its streams.
        this._isSimpleChild = true;

        this.padLevels = parent.padLevels;
        this.setLevels(parent.levels);
        this._level = parent._level;

        this._names = parent._names;

        this.interceptors = parent.interceptors;
        this.rewriters = parent.rewriters;
        this.transports = parent.transports;
        this.serializers = parent.serializers;

        return;
    }

    // Null values.
    var that = this;
    if (parent) {
        this.padLevels = parent.padLevels;
        this.setLevels(parent.levels);

        this._level = options.level || parent._level;
        this._names = common.copy(parent._names);

        this.interceptors = common.copy(parent.interceptors);
        this.rewriters = common.copy(parent.rewriters);
        this.transports = common.copy(parent.transports);

    } else {
        //
        // Set Levels and default logging level
        //
        this.padLevels = options.padLevels || false;
        this.setLevels(options.levels);
        if (options.colors) {
            config.addColors(options.colors);
        }

        this._level = options.level || 'info';

        //
        // Setup other intelligent default settings.
        //
        this._names = [];
        this._hnames = [];

        this.interceptors = [];
        this.rewriters = [];
        this.transports = {};
        this.exceptionHandlers = {};

        if (options.exceptionHandlers) {
            handleExceptions = true;
            options.exceptionHandlers.forEach(function (handler) {
                that._hnames.push(handler.name);
                that.exceptionHandlers[handler.name] = handler;
            });
        }

        if (options.handleExceptions || handleExceptions) {
            this.handleExceptions();
        }
    }

    this.profilers = {};

    var handleExceptions = false;
    //
    // Hoist other options onto this instance.
    //
    this.emitErrs = options.emitErrs || false;
    this.stripColors = options.stripColors || false;
    this.exitOnError = typeof options.exitOnError !== 'undefined'
        ? options.exitOnError
        : true;

    if (options.transports) {
        var isarray = Array.isArray(options.transports);

        common.forEach(options.transports, function (transport, key) {
            if (!isarray && !transport.type) transport.type = key;
            transport = that.add(transport);

            if (transport.handleExceptions) {
                handleExceptions = true;
            }
        });
    }

    if (options.interceptors) {
        options.interceptors.forEach(function (interceptor) {
            that.intercept(interceptor);
        });
    }

    if (options.rewriters) {
        options.rewriters.forEach(function (rewriter) {
            that.addRewriter(rewriter);
        });
    }

    xxx('Logger: ', that);
};

//
// Inherit from `EventEmitter`.
//
util.inherits(Logger, EventEmitter);

/**
 * Create a child logger, typically to add a few log record fields.
 *
 * This can be useful when passing a logger to a sub-component, e.g. a
 * 'wuzzle' component of your service:
 *
 *    var wuzzleLog = log.child({component: 'wuzzle'})
 *    var wuzzle = new Wuzzle({..., log: wuzzleLog})
 *
 * Then log records from the wuzzle code will have the same structure as
 * the app log, *plus the component='wuzzle' field*.
 *
 * @param options {Object} Optional. Set of options to apply to the child.
 *    All of the same options for a new Logger apply here. Notes:
 *      - The parent's streams are inherited and cannot be removed in this
 *        call. Any given `streams` are *added* to the set inherited from
 *        the parent.
 *      - The parent's serializers are inherited, though can effectively be
 *        overwritten by using duplicate keys.
 *      - Can use `level` to set the level of the streams inherited from
 *        the parent. The level for the parent is NOT affected.
 * @param simple {Boolean} Optional. Set to true to assert that child
 *    only copy froom parent's necessary properties. IOW, this is a fast
 *    path for frequent child creation. See 'tools/timechild.js' for numbers.
 */
Logger.prototype.child = function (options, simple) {
    var child = new Logger(this, options || {}, simple);
    child.pipe(this);
    return child;
};

//
// ### function extend (target)
// #### @target {Object} Target to extend.
// Extends the target object with a 'log' method
// along with a method for each level in this instance.
//
Logger.prototype.extend = function (target) {
    var that = this;
    ['log', 'profile', 'startTimer'].concat(Object.keys(this.levels)).forEach(function (method) {
        target[method] = function () {
            return that[method].apply(that, arguments);
        };
    });

    return this;
};

//
// ### function log (level, [id], msg, [data], callback)
// #### @level {string} Level at which to log the message.
// #### @id {string} id label
// #### @msg {string} Message to log
// #### @data {Object} **Optional** Additional metadata to attach
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Wide. Metadata is optional.
//
Logger.prototype.log = function (level) {

    var that = this,
        args = Array.prototype.slice.call(arguments, 1);

    while (args[args.length - 1] === null) {
        args.pop();
    }

    var lastArg = args[args.length - 1];
    var callback = typeof lastArg === 'function' ? args.pop() : null;

    lastArg = args[args.length - 1];
    var data = (typeof lastArg === 'object' && !Array.isArray(lastArg)) ? args.pop() : {};

    var id;
    if (args.length > 1 && !formatRegExp.test(String(args[0]))) {
        id = args.shift();
    }
    var msg = util.format.apply(null, args);

    // If we should pad for levels, do so
    //if (this.padLevels) {
    //    msg = new Array(this.levelLength - level.length + 1).join(' ') + msg;
    //}

    function onError(err) {
        if (callback) {
            callback(err);
        }
        else if (that.emitErrs) {
            that.emit('error', err);
        }
    }


    //if (Object.keys(this.transports).length === 0) {
    //    return onError(new Error('Cannot log with no transports.'));
    //}

    if (typeof that.levels[level] === 'undefined') {
        return onError(new Error('Unknown log level: ' + level));
    }

    this.rewriters.forEach(function (rewriter) {
        data = rewriter(level, msg, data);
    });

    //
    // For consideration of terminal 'color" programs like colors.js,
    // which can add ANSI escape color codes to strings, we destyle the
    // ANSI color escape codes when `this.stripColors` is set.
    //
    // see: http://en.wikipedia.org/wiki/ANSI_escape_code
    //
    if (this.stripColors) {
        var code = /\u001b\[(\d+(;\d+)*)?m/g;
        msg = ('' + msg).replace(code, '');
    }

    // log record
    var rec = mkRecord(level, id, msg, data);

    this.interceptors.forEach(function (interceptor) {
        interceptor.call(this, rec);
    });

    //
    // Log for each transport and emit 'logging' event
    //
    function emit(name, next) {
        var transport = that.transports[name];
        if ((transport.level && that.levels[transport.level] <= that.levels[level])
            || (!transport.level && that.levels[that.level] <= that.levels[level])) {
            transport.log(rec, function (err) {
                if (err) {
                    err.transport = transport;
                    cb(err);
                    return next();
                }
                that.emit('logging', transport, rec);
                next();
            });
        } else {
            next();
        }
    }

    //
    // Respond to the callback
    //
    function cb(err) {
        if (callback) {
            if (err) return callback(err);
            callback(null, rec);
        }
        callback = null;
        if (!err) {
            that.emit('logged', rec);
        }
    }

    async.forEach(this._names, emit, cb);

    return this;
};

function mkRecord(level, id, msg, data) {
    return {
        level: level,
        id: id,
        message: msg,
        data: data
    };
}

//
// ### function query (options, callback)
// #### @options {Object} Query options for this instance.
// #### @callback {function} Continuation to respond to when complete.
// Queries the all transports for this instance with the specified `options`.
// This will aggregate each transport's results into one object containing
// a property per transport.
//
Logger.prototype.query = function (options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    options = options || {};

    var that = this,
        results = {},
        query = common.clone(options.query) || {},
        transports;

    //
    // Helper function to query a single transport
    //
    function queryTransport(transport, next) {
        if (options.query) {
            options.query = transport.formatQuery(query);
        }

        transport.query(options, function (err, results) {
            if (err) {
                return next(err);
            }

            next(null, transport.formatResults(results, options.format));
        });
    }

    //
    // Helper function to accumulate the results from
    // `queryTransport` into the `results`.
    //
    function addResults(transport, next) {
        queryTransport(transport, function (err, result) {
            //
            // queryTransport could potentially invoke the callback
            // multiple times since Transport code can be unpredictable.
            //
            if (next) {
                result = err || result;
                if (result) {
                    results[transport.name] = result;
                }

                next();
            }

            next = null;
        });
    }

    //
    // If an explicit transport is being queried then
    // respond with the results from only that transport
    //
    if (options.transport) {
        options.transport = options.transport.toLowerCase();
        return queryTransport(this.transports[options.transport], callback);
    }

    //
    // Create a list of all transports for this instance.
    //
    transports = this._names.map(function (name) {
        return that.transports[name];
    }).filter(function (transport) {
        return !!transport.query;
    });

    //
    // Iterate over the transports in parallel setting the
    // appropriate key in the `results`
    //
    async.forEach(transports, addResults, function () {
        callback(null, results);
    });
};

//
// ### function stream (options)
// #### @options {Object} Stream options for this instance.
// Returns a log stream for all transports. Options object is optional.
//
Logger.prototype.stream = function (options) {
    options = options || {};

    var that = this,
        out = new Stream,
        streams = [],
        transports;

    if (options.transport) {
        var transport = this.transports[options.transport];
        delete options.transport;
        if (transport && transport.stream) {
            return transport.stream(options);
        }
    }

    out._streams = streams;
    out.destroy = function () {
        var i = streams.length;
        while (i--) streams[i].destroy();
    };

    //
    // Create a list of all transports for this instance.
    //
    transports = this._names.map(function (name) {
        return that.transports[name];
    }).filter(function (transport) {
        return !!transport.stream;
    });

    transports.forEach(function (transport) {
        var stream = transport.stream(options);
        if (!stream) return;

        streams.push(stream);

        stream.on('log', function (log) {
            log.transport = log.transport || [];
            log.transport.push(transport.name);
            out.emit('log', log);
        });

        stream.on('error', function (err) {
            err.transport = err.transport || [];
            err.transport.push(transport.name);
            out.emit('error', err);
        });
    });

    return out;
};

//
// ### function close ()
// Cleans up resources (streams, event listeners) for all
// transports associated with this instance (if necessary).
//
Logger.prototype.close = function () {
    var that = this;

    this._names.forEach(function (name) {
        var transport = that.transports[name];
        if (transport && transport.close) {
            transport.close();
        }
    });
};

//
// ### function handleExceptions ()
// Handles `uncaughtException` events for the current process
//
Logger.prototype.handleExceptions = function () {
    var args = Array.prototype.slice.call(arguments),
        handlers = [],
        that = this;

    args.forEach(function (a) {
        if (Array.isArray(a)) {
            handlers = handlers.concat(a);
        }
        else {
            handlers.push(a);
        }
    });

    handlers.forEach(function (handler) {
        that.exceptionHandlers[handler.name] = handler;
    });

    this._hnames = Object.keys(that.exceptionHandlers);

    if (!this.catchExceptions) {
        this.catchExceptions = this._uncaughtException.bind(this);
        process.on('uncaughtException', this.catchExceptions);
    }
};

//
// ### function unhandleExceptions ()
// Removes any handlers to `uncaughtException` events
// for the current process
//
Logger.prototype.unhandleExceptions = function () {
    var that = this;

    if (this.catchExceptions) {
        Object.keys(this.exceptionHandlers).forEach(function (name) {
            var handler = that.exceptionHandlers[name];
            if (handler.close) {
                handler.close();
            }
        });

        this.exceptionHandlers = {};
        Object.keys(this.transports).forEach(function (name) {
            var transport = that.transports[name];
            if (transport.handleExceptions) {
                transport.handleExceptions = false;
            }
        });

        process.removeListener('uncaughtException', this.catchExceptions);
        this.catchExceptions = false;
    }
};

//
// ### function add (transport, [options])
// #### @transport {Transport} Prototype of the Transport object to add.
// #### @options {Object} **Optional** Options for the Transport to add.
// #### @instance {Boolean} **Optional** Value indicating if `transport` is already instantiated.
// Adds a transport of the specified type to this instance.
//
Logger.prototype.add = function (transport, options) {
    var instance = transports.get(transport, options);

    if (!instance.name && !instance.log) {
        throw new Error('Unknown transport with no log() method');
    }
    if (this.transports[instance.name]) {
        xxx('Override the transport already attached: ' + instance.name);
    }

    this.transports[instance.name] = instance;
    this._names = Object.keys(this.transports);

    //
    // Listen for the `error` event on the new Transport
    //
    instance._onError = this._onError.bind(this, instance);
    instance.on && instance.on('error', instance._onError);

    //
    // If this transport has `handleExceptions` set to `true`
    // and we are not already handling exceptions, do so.
    //
    if (instance.handleExceptions && !this.catchExceptions) {
        this.handleExceptions();
    }

    return instance;
};

//
// ### function addRewriter (transport, [options])
// #### @transport {Transport} Prototype of the Transport object to add.
// #### @options {Object} **Optional** Options for the Transport to add.
// #### @instance {Boolean} **Optional** Value indicating if `transport` is already instantiated.
// Adds a transport of the specified type to this instance.
//
Logger.prototype.addRewriter = function (rewriter) {
    this.rewriters.push(rewriter);
    return this;
};

Logger.prototype.intercept = function (fn) {
    this.interceptors.push(fn);
    return this;
};

//
// ### function clear ()
// Remove all transports from this instance
//
Logger.prototype.clear = function () {
    for (var name in this.transports) {
        this.remove({name: name});
    }
    return this;
};

//
// ### function remove (transport)
// #### @transport {Transport} Transport to remove.
// Removes a transport of the specified type from this instance.
//
Logger.prototype.remove = function (transport) {
    var name = transport.name || transport.prototype.name;

    if (!this.transports[name]) {
        throw new Error('Transport ' + name + ' not attached to this instance');
    }

    var instance = this.transports[name];
    delete this.transports[name];
    this._names = Object.keys(this.transports);

    if (instance.close) {
        instance.close();
    }

    instance.removeListener('error', instance._onError);
    return this;
};

var ProfileHandler = function (logger) {
    this.logger = logger;

    this.start = Date.now();

    this.done = function (msg) {
        var args, callback, data;
        args = Array.prototype.slice.call(arguments);
        callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
        data = typeof args[args.length - 1] === 'object' ? args.pop() : {};

        data.duration = (Date.now()) - this.start + 'ms';

        return this.logger.info(msg, data, callback);
    }
};

Logger.prototype.startTimer = function () {
    return new ProfileHandler(this);
};

//
// ### function profile (id, [msg, data, callback])
// #### @id {string} Unique id of the profiler
// #### @msg {string} **Optional** Message to log
// #### @data {Object} **Optional** Additional metadata to attach
// #### @callback {function} **Optional** Continuation to respond to when complete.
// Tracks the time inbetween subsequent calls to this method
// with the same `id` parameter. The second call to this method
// will log the difference in milliseconds along with the message.
//
Logger.prototype.profile = function (id) {
    var now = Date.now(), then, args,
        msg, data, callback;

    if (this.profilers[id]) {
        then = this.profilers[id];
        delete this.profilers[id];

        // Support variable arguments: msg, data, callback
        args = Array.prototype.slice.call(arguments);
        callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
        data = typeof args[args.length - 1] === 'object' ? args.pop() : {};
        msg = args.length === 2 ? args[1] : id;

        // Set the duration property of the metadata
        data.duration = now - then + 'ms';
        return this.info(id, msg, data, callback);
    }
    else {
        this.profilers[id] = now;
    }

    return this;
};

//
// ### function setLevels (target)
// #### @target {Object} Target levels to use on this instance
// Sets the `target` levels specified on this instance.
//
Logger.prototype.setLevels = function (target) {
    return common.setLevels(this, this.levels, target);
};

//
// ### function cli ()
// Configures this instance to have the default
// settings for command-line interfaces: no timestamp,
// colors enabled, padded output, and additional levels.
//
Logger.prototype.cli = function (appname, options) {
    if (typeof appname === 'object') {
        options = appname;
    }

    var that = this;
    this.padLevels = true;
    this.setLevels(config.cli.levels);
    config.addColors(config.cli.colors);

    if (appname) {
        this._names.forEach(function (name) {
            that.transports[name].appname = appname;
            common.mixin(that.transports[name], {
                colorize: true,
                timestamp: false
            }, options);
        });
    }

    return this;
};

Object.defineProperty(Logger.prototype, 'level', {
    get: function () {
        return this._level;
    },
    set: function (val) {
        var that = this;
        this._level = val;

        Object.keys(this.transports).forEach(function (key) {
            that.transports[key].level = val;
        });
    }
});

//
// ### @private function _uncaughtException (err)
// #### @err {Error} Error to handle
// Logs all relevant information around the `err` and
// exits the current process.
//
Logger.prototype._uncaughtException = function (err) {
    var responded = false,
        info = exception.getAllInfo(err),
        handlers = this._getExceptionHandlers(),
        timeout,
        doExit;

    //
    // Calculate if we should exit on this error
    //
    doExit = typeof this.exitOnError === 'function'
        ? this.exitOnError(err)
        : this.exitOnError;

    function logAndWait(transport, next) {
        transport.logException('uncaughtException: ' + (err.message || err), info, next, err);
    }

    function gracefulExit() {
        if (doExit && !responded) {
            //
            // Remark: Currently ignoring any exceptions from transports
            //         when catching uncaught exceptions.
            //
            clearTimeout(timeout);
            responded = true;
            process.exit(1);
        }
    }

    if (!handlers || handlers.length === 0) {
        return gracefulExit();
    }

    //
    // Log to all transports and allow the operation to take
    // only up to `3000ms`.
    //
    async.forEach(handlers, logAndWait, gracefulExit);
    if (doExit) {
        timeout = setTimeout(gracefulExit, 3000);
    }
};

//
// ### @private function _getExceptionHandlers ()
// Returns the list of transports and exceptionHandlers
// for this instance.
//
Logger.prototype._getExceptionHandlers = function () {
    var that = this;

    return this._hnames.map(function (name) {
        return that.exceptionHandlers[name];
    }).concat(this._names.map(function (name) {
        return that.transports[name].handleExceptions && that.transports[name];
    })).filter(Boolean);
};

//
// ### @private function _onError (transport, err)
// #### @transport {Object} Transport on which the error occured
// #### @err {Error} Error that occurred on the transport
// Bubbles the error, `err`, that occured on the specified `transport`
// up from this instance if `emitErrs` has been set.
//
Logger.prototype._onError = function (transport, err) {
    if (this.emitErrs) {
        this.emit('error', err, transport);
    }
};


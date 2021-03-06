var util = require('util'),
    crypto = require('crypto'),
    fs = require('fs'),
    df = require('./df'),
    config = require('./config');

//
// ### function setLevels (target, past, current)
// #### @target {Object} Object on which to set levels.
// #### @past {Object} Previous levels set on target.
// #### @current {Object} Current levels to set on target.
// Create functions on the target objects for each level
// in current.levels. If past is defined, remove functions
// for each of those levels.
//
exports.setLevels = function (target, past, current, isDefault) {
    if (past) {
        Object.keys(past).forEach(function (level) {
            delete target[level];
        });
    }

    target.levels = current || config.cli.levels;
    if (target.padLevels) {
        target.levelLength = exports.longestElement(Object.keys(target.levels));
    }

    //
    //  Define prototype methods for each log level
    //  e.g. target.log('info', msg) <=> target.info(msg)
    //
    Object.keys(target.levels).forEach(function (level) {
        target[level] = function (msg) {
            // build argument list (level, msg, ... [string interpolate], [{metadata}], [callback])
            var args = [level].concat(Array.prototype.slice.call(arguments));
            target.log.apply(target, args);
        };
    });

    return target;
};

//
// ### function longestElement
// #### @xs {Array} Array to calculate against
// Returns the longest element in the `xs` array.
//
exports.longestElement = function (xs) {
    return Math.max.apply(
        null,
        xs.map(function (x) {
            return x.length;
        })
    );
};

//
// ### function clone (obj)
// #### @obj {Object} Object to clone.
// Helper method for deep cloning pure JSON objects
// i.e. JSON objects that are either literals or objects (no Arrays, etc)
//
exports.clone = function (obj) {
    // we only need to clone refrence types (Object)
    if (!(obj instanceof Object)) {
        return obj;
    }
    else if (obj instanceof Date) {
        return obj;
    }

    var copy = {};
    for (var i in obj) {
        if (Array.isArray(obj[i])) {
            copy[i] = obj[i].slice(0);
        }
        else if (obj[i] instanceof Buffer) {
            copy[i] = obj[i].slice(0);
        }
        else if (typeof obj[i] != 'function') {
            copy[i] = obj[i] instanceof Object ? exports.clone(obj[i]) : obj[i];
        }
        else if (typeof obj[i] === 'function') {
            copy[i] = obj[i];
        }
    }

    return copy;
};

exports.capitalize = function (str) {
    return str && str[0].toUpperCase() + str.slice(1);
};

//
// ### function hash (str)
// #### @str {string} String to hash.
// Utility function for creating unique ids
// e.g. Profiling incoming HTTP requests on the same tick
//
exports.hash = function (str) {
    return crypto.createHash('sha1').update(str).digest('hex');
};

//
// ### function pad (n)
// Returns a padded string if `n < 10`.
//
exports.pad = function (n) {
    return n < 10 ? '0' + n.toString(10) : n.toString(10);
};

//
// ### function timestamp ()
// Returns a timestamp string for the current time.
//
exports.timestamp = function (format) {
    if (typeof format === 'string') {
        format = df[format.toUpperCase()] || format;
    } else {
        format = df.SHORT;
    }
    return df.asString(format, new Date());
};

exports.repeat = function (s, n) {
    var result = "";
    while (n--) result += s;
    return result;
};

//
// ### function serialize (obj, key)
// #### @obj {Object|literal} Object to serialize
// #### @key {string} **Optional** Optional key represented by obj in a larger object
// Performs simple comma-separated, `key=value` serialization for Loggly when
// logging to non-JSON inputs.
//
exports.serialize = function (obj, key) {
    if (obj === null) {
        obj = 'null';
    }
    else if (obj === undefined) {
        obj = 'undefined';
    }
    else if (obj === false) {
        obj = 'false';
    }

    if (typeof obj !== 'object') {
        return key ? key + '=' + obj : obj;
    }

    if (obj instanceof Buffer) {
        return key ? key + '=' + obj.toString('base64') : obj.toString('base64');
    }

    var msg = '',
        keys = Object.keys(obj),
        length = keys.length;

    for (var i = 0; i < length; i++) {
        if (Array.isArray(obj[keys[i]])) {
            msg += keys[i] + '=[';

            for (var j = 0, l = obj[keys[i]].length; j < l; j++) {
                msg += exports.serialize(obj[keys[i]][j]);
                if (j < l - 1) {
                    msg += ', ';
                }
            }

            msg += ']';
        }
        else if (obj[keys[i]] instanceof Date) {
            msg += keys[i] + '=' + obj[keys[i]];
        }
        else {
            msg += exports.serialize(obj[keys[i]], keys[i]);
        }

        if (i < length - 1) {
            msg += ', ';
        }
    }

    return msg;
};


//
// ### function tailFile (options, callback)
// #### @options {Object} Options for tail.
// #### @callback {function} Callback to execute on every line.
// `tail -f` a file. Options must include file.
//
exports.tailFile = function tail(options, callback) {
    var stream = fs.createReadStream(options.file, {encoding: 'utf8'}),
        buff = '',
        destroy,
        row = 0;

    destroy = stream.destroy.bind(stream);
    stream.destroy = function () {
    };

    if (options.start === -1) {
        delete options.start;
    }

    stream.on('data', function (data) {
        var data = (buff + data).split(/\n+/),
            l = data.length - 1,
            i = 0;

        for (; i < l; i++) {
            if (options.start == null || row > options.start) {
                callback(null, data[i]);
            }
            row++;
        }

        buff = data[l];
    });

    stream.on('error', function (err) {
        callback(err);
        destroy();
    });

    stream.on('end', function () {
        if (buff) {
            stream.emit('line', buff);
            buff = '';
        }

        resume();
    });

    function resume() {
        setTimeout(function () {
            stream.resume();
        }, 1000);
    }

    return destroy;
};

exports.mixin = function mixin(target) {
    var args = Array.prototype.slice.call(arguments, 1);

    args.forEach(function (a) {
        if (!a) return;
        var keys = Object.keys(a);
        for (var i = 0; i < keys.length; i++) {
            target[keys[i]] = a[keys[i]];
        }
    });
    return target;
};

exports.copy = function copy(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    } else if (Array.isArray(obj)) {
        return obj.slice();
    } else {
        var copy = {};
        Object.keys(obj).forEach(function (k) {
            copy[k] = obj[k];
        });
        return copy;
    }
};

exports.forEach = function (target, cb) {
    cb = cb || function () {};
    if (Array.isArray(target)) {
        for (var i = 0; i < target.length; i++) {
            cb(target[i], i);
        }
    } else if (target) {
        Object.keys(target).forEach(function (key) {
            cb(target[key], key);
        })
    }
};

var assert = require('chai').assert;
var Logger = require('../lib/logger').Logger;
var transports = require('../lib/transports');

describe('logger', function () {

    describe('.intercept', function () {
        var logger;

        beforeEach(function () {
            logger = new Logger({
                emitErrs: true
            });
            logger.on('error', function (err) {
                throw err;
            })
        });

        it('should add the function and call it when a log occurs', function (next) {
            var called;
            var data = {
                'some': 'thing'
            };

            logger.intercept(function (log) {
                called = true;

                assert.deepEqual(log, {
                    level: 'warn',
                    id: 'foo',
                    message: 'bar',
                    data: data
                });
                assert.equal(log.data, data);
            });

            logger.log('warn', 'foo', 'bar', data);

            assert.isTrue(called);
            next();
        });

        it('should call the interceptors by order before emitting the event', function (next) {
            var called = [];

            logger.intercept(function () {
                called.push(1);
            });
            logger.intercept(function () {
                called.push(2);
            });

            logger.log('warn', 'foo', 'bar');

            assert.deepEqual(called, [1, 2]);
            next();
        });

        it('should call the interceptors along the chain', function (next) {
            var called = [];

            logger.intercept(function () {
                called.push(1);
            });

            var childLogger = logger.child();

            childLogger.intercept(function () {
                called.push(2);
            });

            childLogger.on('logged', function () {
                called.push(3);
            });

            logger.on('logged', function () {
                called.push(4);
            });

            childLogger.log('warn', 'foo', 'bar');

            assert.deepEqual(called, [1, 2, 3, 4]);
            next();
        });
    });

    describe('transports', function () {

        it('should add transports with array config', function () {
            var logger = new Logger({
                transports: [
                    {type: 'console'},
                    {type: 'webhook', 'host': 'localhost', 'port': 8080, 'path': '/collectdata'}
                ]
            });
            assert.lengthOf(Object.keys(logger.transports), 2);
            assert.instanceOf(logger.transports.console, transports.Console);
            assert.instanceOf(logger.transports.webhook, transports.Webhook);
        });

        it('should add transports with array transport instances', function () {
            var logger = new Logger({
                transports: [
                    new transports.Console(),
                    new transports.Webhook({'host': 'localhost', 'port': 8080, 'path': '/collectdata'})
                ]
            });
            assert.lengthOf(Object.keys(logger.transports), 2);
            assert.instanceOf(logger.transports.console, transports.Console);
            assert.instanceOf(logger.transports.webhook, transports.Webhook);
        });

        it('should add transports with object config', function () {
            var logger = new Logger({
                transports: {
                    console: {},
                    webhook: {host: 'localhost', 'port': 8080, 'path': ' / collectdata'}
                }
            });
            assert.lengthOf(Object.keys(logger.transports), 2);
            assert.instanceOf(logger.transports.console, transports.Console);
            assert.instanceOf(logger.transports.webhook, transports.Webhook);
        });
    });

});
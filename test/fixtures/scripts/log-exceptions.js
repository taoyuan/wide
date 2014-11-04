/*
 * log-exceptions.js: A test fixture for logging exceptions in wide.
 *
 * (C) 2011 Charlie Robbins
 * MIT LICENCE
 *
 */
 
var path = require('path'),
    wide = require('../../../lib/wide');

var logger = new (wide.Logger)({
  transports: [
    new (wide.transports.File)({
      filename: path.join(__dirname, '..', 'logs', 'exception.log'),
      handleExceptions: true
    })
  ]
});

logger.handleExceptions();

setTimeout(function () {
  throw new Error('OH NOES! It failed!');
}, 1000);
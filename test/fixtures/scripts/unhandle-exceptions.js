/*
 * unhandle-exceptions.js: A test fixture for using `.unhandleExceptions()` firelog.
 *
 * (C) 2011 Charlie Robbins
 * MIT LICENCE
 *
 */
 
var path = require('path'),
    firelog = require('../../../lib/firelog');

var logger = new (firelog.Logger)({
  transports: [
    new (firelog.transports.File)({
      filename: path.join(__dirname, '..', 'logs', 'unhandle-exception.log'),
      handleExceptions: true
    })
  ]
});

logger.handleExceptions();
logger.unhandleExceptions();

setTimeout(function () {
  throw new Error('OH NOES! It failed!');
}, 1000);
'use strict';

/**
 * Starts the charon container-to-container DNS server.
 * @module charon
 * @author Ryan Sandor Richards
 */

var debug = require('debug');
var error = debug('charon:error');
var server = require('./lib/server.js');

server.start(function (err) {
  if (err) {
    error('Could not start server: ' + err);
    process.kill(1);
  }
});

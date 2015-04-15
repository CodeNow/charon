'use strict';

/**
 * Starts the charon container-to-container DNS server.
 * @module charon
 * @author Ryan Sandor Richards
 */

var debug = require('debug');
var error = debug('charon:error');
var ClusterManager = require('cluster-man');
var server = require('./lib/server.js');

var manager = new ClusterManager(function () {
  server.start(function (err) {
    if (err) {
      error('Could not start server: ' + err);
      process.kill(1);
    }
  });
});

// Start the cluster
manager.start();

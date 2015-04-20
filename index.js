'use strict';

/**
 * Starts the charon container-to-container DNS server.
 * @module charon
 * @author Ryan Sandor Richards
 */

var ClusterManager = require('cluster-man');
var server = require('./lib/server.js');
var monitor = require('monitor-dog');
var debug = require('debug');
var error = debug('charon:error');

var manager = new ClusterManager({
  master: function () {
    monitor.histogram('status', 1);
  },
  worker: function() {
    server.start(function (err) {
      if (err) {
        error('Could not start server: ' + err);
        process.kill(1);
      }
    });
  },
  beforeExit: function (done) {
    monitor.histogram('status', 0);
    done();
  }
});

// Start the cluster
manager.start();

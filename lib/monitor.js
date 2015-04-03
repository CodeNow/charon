'use strict';

/**
 * Application Monitoring for Charon. Wrapping the Datadog and New Relic
 * monitoring scripts allows us to ensure we are sending the appropriate
 * data in our tests (by stubbing the methods here with sinon).
 *
 * @module charon:monitor
 * @author Ryan Sandor Richards
 */

require('./loadenv')();
var StatsD = require('node-dogstatsd').StatsD;
var exists = require('101/exists');

/**
 * Timer class for performing time calculations through the monitor
 * module.
 * @class
 */
function Timer(callback, start) {
  this.callback = callback;
  if (!exists(start) || start !== false) {
    this.start();
  }
}

/**
 * Starts the timer.
 */
Timer.prototype.start = function () {
  if (this.startDate) {
    return;
  }
  this.startDate = new Date();
};

/**
 * Stops the timer and sends information through datadog.
 */
Timer.prototype.stop = function () {
  if (!this.startDate) {
    return;
  }
  this.callback(new Date() - this.startDate);
};

/**
 * Monitoring and reporting.
 * @class
 * @param {string} [host] Datadog host.
 * @param {string} [port] Datadog port.
 */
function Monitor(host, port) {
  this.host = host || process.env.DATADOG_HOST;
  this.port = port || process.env.DATADOG_PORT;
  this.client = new StatsD(this.host, this.port);
}

/**
 * Factory method for creating custom monitors.
 * @param {string} [host] Datadog host.
 * @param {string} [port] Datadog port.
 */
Monitor.prototype.createMonitor = function (host, port) {
  return new Monitor(host, port);
};

/**
 * Helper alias for `monitor.client.set`.
 */
Monitor.prototype.set = function () {
  this.client.set.apply(this.client, arguments);
};

/**
 * Helper alias for `monitor.client.alias`.
 */
Monitor.prototype.increment = function () {
  this.client.increment.apply(this.client, arguments);
};

/**
 * Helper alias for `monitor.client.histogram`.
 */
Monitor.prototype.histogram = function () {
  this.client.histogram.apply(this.client, arguments);
};

/**
 * Helper alias for `monitor.client.gauge`.
 */
Monitor.prototype.gauge = function () {
  this.client.gauge.apply(this.client, arguments);
};

/**
 * Creates a new timer for the given histogram name.
 *
 * @example
 * // Create and start a new timer
 * var myTimer = monitor.timer('function.time');
 * // Stop the timer once the task is complete
 * // This sends the information to a histogram named 'function.time'
 * doSomething();
 * myTimer.stop();
 *
 * @example
 * // Time an asynchonous process
 * var myTimer = monitor.timer('function.async.time');
 * asyncTask(function(result) {
 *   // Stop the timer and send information to datadog
 *   myTimer.stop();
 * });
 *
 * @param {string} histName Name of the histogram to report the timer's output.
 * @param {boolean} [start] Whether or not to immediately start timing,
 *   default: `true`.
 * @return {Timer} Timer object that can be stopped when timing is finished.
 */
Monitor.prototype.timer = function (histName, start) {
  var self = this;
  return new Timer(function(duration) {
    self.histogram(histName, duration);
  }, start);
};

/**
 * Monitor instance exported by the module.
 * @type {Monitor}
 */
var instance = module.exports = new Monitor();

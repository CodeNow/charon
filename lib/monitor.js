'use strict';

/**
 * Application Monitoring for Charon. Wrapping the Datadog and New Relic
 * monitoring scripts allows us to ensure we are sending the appropriate
 * data in our tests (by stubbing the methods here with sinon).
 *
 * @module charon:monitor
 * @author Ryan Sandor Richards
 */

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
 */
function Monitor() {
  this.client = new StatsD(
    process.env.DATADOG_HOST,
    process.env.DATADOG_PORT
  );
}

/**
 * Adds a unique value to a datadog set.
 * @param {string} name Name of the set.
 * @param value Value to add to the set.
 */
Monitor.prototype.set = function (name, value) {
  this.client.set(name, value);
};

/**
 * Increments a named counter through datadog.
 * @param {string} name Name of the counter to increment.
 * @param {number} [amount] Amount by which to increment the counter.
 */
Monitor.prototype.increment = function (name, amount) {
  this.client.increment(name, amount);
};

/**
 * Sends histogram information to datadog.
 * @param name Name of the histogram value to update.
 * @param value Value for the update.
 */
Monitor.prototype.histogram = function (name, value) {
  this.client.histogram(name, value);
};

/**
 * Updates a datadog gauge.
 * @param {string} name Name of the gauge.
 * @param value Value for the gauge.
 */
Monitor.prototype.gauge = function (name, value) {
  this.client.gauge(name, value);
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

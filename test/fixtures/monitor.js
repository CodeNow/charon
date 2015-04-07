'use strict';

var monitor = require('../../lib/monitor');
var clientMethods = ['set', 'increment', 'histogram', 'gauge'];
var sinon = require('sinon');

/**
 * Stubs all alias methods for the monitor module.
 */
function stubAll() {
  clientMethods.forEach(function (methodName) {
    sinon.stub(monitor, methodName);
  });
}

/**
 * Restores all stubbed alias methods for the monitor module.
 */
function restoreAll() {
  clientMethods.forEach(function (methodName) {
    monitor[methodName].restore();
  });
}

module.exports = {
  stubAll: stubAll,
  restoreAll: restoreAll
}

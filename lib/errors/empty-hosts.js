'use strict';

/**
 * Error class for empty hosts
 */
module.exports = function () {
  var emptyHostError = new Error('IP returned by API is empty.');
  emptyHostError.report = false;
  return emptyHostError;
};

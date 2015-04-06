'use strict';

/**
 * Interface for connecting to the runnable api.
 * @module charon:api-client
 * @author Ryan Sandor Richards
 */

require('loadenv')('charon:env');
var debug = require('debug');
var User = require('runnable');

var user = new User(process.env.API_HOST);
var isLoggedIn = false;
var error = debug('charon:api-client:error');

/**
 * Connects and logs the API client in.
 * @param {Function} cb Callback to execute after logging in.
 */
function login(cb) {
  if (isLoggedIn) { return cb(); }
  isLoggedIn = true;
  user.githubLogin(process.env.API_TOKEN, function(err) {
    if (err) {
      isLoggedIn = false;
      error(err);
    }
    cb(err);
  });
}

/**
 * Logs the API client out.
 * @param {Function} cb Callback to execute after logging out.
 */
function logout(cb) {
  if (!isLoggedIn) { return cb(); }
  isLoggedIn = false;
  user.logout(function(err) {
    if (err) {
      isLoggedIn = true;
      error(err);
    }
    cb(err);
  });
}

module.exports = {
  login: login,
  logout: logout,
  user: user
};

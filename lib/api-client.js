'use strict';

require('loadenv')('charon:env');
var User = require('runnable');
var log = require('./logger').child({ module: 'api-client' }, true);

/**
 * Api client user.
 * @type {runnable~User}
 */
var user = new User(process.env.API_HOST);

/**
 * Whether or not the client is logged in.
 * @type {boolean}
 */
var isLoggedIn = false;

/**
 * Interface for connecting to the runnable api.
 * @module charon:api-client
 * @author Ryan Sandor Richards
 */
module.exports = {
  login: login,
  logout: logout,
  user: user
};

/**
 * Connects and logs the API client in.
 * @param {Function} cb Callback to execute after logging in.
 */
function login(cb) {
  if (isLoggedIn) { return cb(); }
  isLoggedIn = true;

  log.info({
    host: process.env.API_HOST,
    token: process.env.API_TOKEN
  }, 'API Client Login');

  user.githubLogin(process.env.API_TOKEN, function(err) {
    if (err) {
      isLoggedIn = false;
      log.error(err);
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

  log.info('API Client Logout');

  user.logout(function(err) {
    if (err) {
      isLoggedIn = true;
      log.error(err);
    }
    cb(err);
  });
}

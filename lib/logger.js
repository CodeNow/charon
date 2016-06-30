'use strict';

/**
 * Bunyan logger for charon.
 * @author Ryan Sandor Richards
 * @module charon:logger
 */

require('loadenv')({ debugName: 'charon' });

var Bunyan2Loggly = require('bunyan-loggly').Bunyan2Loggly;
var bsyslog = require('bunyan-syslog');
var bunyan = require('bunyan');
var path = require('path');
var put = require('101/put');

var streams = [];

streams.push({
  level: process.env.LOG_LEVEL,
  type: 'raw',
  // Defaults to attempting syslogd at 127.0.0.1:514
  stream: bsyslog.createBunyanStream({
    type: 'sys',
  facility: bsyslog.local7,
  host: '127.0.0.1',
  port: 514
  })
});

var logger = module.exports = bunyan.createLogger({
  name: 'charon',
  streams: streams,
  serializers: bunyan.stdSerializers,
  // DO NOT use src in prod, slow
  src: !!process.env.LOG_SRC,
  // default values included in all log objects
  branch: process.env.VERSION_GIT_COMMIT,
  commit: process.env.VERSION_GIT_BRANCH,
  environment: process.env.NODE_ENV,
  host: require('ip').address()
});

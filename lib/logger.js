'use strict';

var bunyan = require('bunyan');

/**
 * Bunyan logger for charon.
 * @author Ryan Sandor Richards
 * @module charon:logger
 */
module.exports = bunyan.createLogger({
  name: 'charon',
  streams: [
    {
      level: process.env.LOG_LEVEL,
      stream: process.stdout
    }
  ],
  serializers: bunyan.stdSerializers
});

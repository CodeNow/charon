'use strict';

var redisPubSub = require('redis-pubsub-emitter');

/**
 * Redis pubsub client.
 * @module charon:pubsub
 */
module.exports = redisPubSub.createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_HOST
);

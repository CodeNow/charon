'use strict';
var dotenv = require('dotenv');
var eson = require('eson');
var path = require('path');
var debug = require('debug')('charon:config');
var env = process.env.NODE_ENV;
var read = false;
var ROOT_DIR = path.resolve(__dirname, '..');

module.exports = function readDotEnvConfigs () {
  if (read === true) {
    return;
  }
  read = true;
  dotenv._getKeysAndValuesFromEnvFilePath(path.resolve(__dirname, '../configs/.env'));
  dotenv._getKeysAndValuesFromEnvFilePath(path.resolve(__dirname, '../configs/.env.'+ env));
  dotenv._setEnvs();
  dotenv.load();

  process.env = eson()
    .use(convertStringToNumeral)
    .parse(JSON.stringify(process.env));

  process.env.ROOT_DIR = ROOT_DIR;

  debug(process.env);
};

function convertStringToNumeral(key, val) {
  if (!isNaN(val)) {
    return parseInt(val);
  } else {
    return val;
  }
}
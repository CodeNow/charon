'use strict';

/**
 * DNS Utilities used by charon. Ideally these would be included by
 * `native-dns`, but it is more of a barebones extension to node's
 * `dns` module.
 * @module charon:dns
 * @author Ryan Sandor Richards
 */

/**
 * Named helper map for various response RCODEs.
 * @type {Object}
 */
var rcode = {
  'NoError': 0,
  'FormatError': 1,
  'ServerFailure': 2,
  'NXDomain': 3,
  'NotImplemented': 4,
  'Refused': 5
};

/**
 * Sets the RCODE for a response given a readable name.
 * @param {Object} res       Response packet for which to set the RCODE.
 * @param {string} rcodeName Name of the RCODE to set for the response.
 */
function setRcode(res, rcodeName) {
  res.header.rcode = rcode[rcodeName] || 0;
}

module.exports = {
  rcode: rcode,
  setRcode: setRcode
};

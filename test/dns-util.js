'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var dns = require('native-dns');
var sinon = require('sinon');

require('../lib/loadenv.js')();
var dnsUtil = require('../lib/dns-util');

describe('dns utilities', function() {

  describe('.rcode', function() {
    it('provides a basic, and correct, RCODE by name map', function (done) {
      var expected = {
        'NoError': 0,
        'FormatError': 1,
        'ServerFailure': 2,
        'NXDomain': 3,
        'NotImplemented': 4,
        'Refused': 5
      };
      for (var name in expected) {
        expect(dnsUtil.rcode[name]).to.equal(expected[name]);
      }
      done();
    });
  });

  describe('.setRcode()', function() {
    it('sets the correct RCODE on a given response object', function (done) {
      var mockRes = {
        header: {
          rcode: -1
        }
      };
      for (var name in dnsUtil.rcode) {
        dnsUtil.setRcode(mockRes, name);
        expect(mockRes.header.rcode).to.equal(dnsUtil.rcode[name]);
      }
      done();
    })

    it('should default to `0` when given an unkown RCODE name', function (done) {
      var mockRes = {
        header: {
          rcode: -1
        }
      };
      dnsUtil.setRcode(mockRes, 'ThisIsNotAThing');
      expect(mockRes.header.rcode).to.equal(dnsUtil.rcode.NoError);
      done();
    });
  });
});

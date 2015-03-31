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
var query = require('../lib/query');
var apiClient = require('../lib/api-client');

describe('query', function() {
  describe('interface', function() {
    it('should expose the resolve method', function (done) {
      expect(query.resolve).to.exist();
      expect(typeof query.resolve).to.equal('function');
      done();
    });
  }); // end 'interface'

  describe('.resolve()', function() {

    describe('basic name resolution', function() {
      before(function (done) {
        sinon.stub(apiClient.user, 'fetchRefererInstanceByDomain', function(address, name, cb) {
          cb(null, { network: { hostIP: '127.0.0.1' } });
        });
        done();
      });
      after(function (done) {
        apiClient.user.fetchRefererInstanceByDomain.restore();
        done();
      });

      it('should resolve internal dns names', function (done) {
        var names = [
          'web-codenow.runnableapp.com',
          'api-codenow.runnableapp.com',
          'example.runnableapp.com'
        ];
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(records.length).to.equal(3);
          names.forEach(function (name, index) {
            expect(records[index].name).to.equal(name);
          });
          done();
        });
      });

      it('should not resolve external dns names', function (done) {
        var names = [
          'www.google.com',
          'www.wikipedia.org',
          'www.ign.com'
        ];
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(records).to.be.null;
          done();
        });
      });

      it('should be able to resolve a mix of external and internal names', function (done) {
        var names = [
          'valid.runnableapp.com',
          'invalid.google.com'
        ];
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(records.length).to.equal(1);
          expect(records[0].name).to.equal('valid.runnableapp.com');
          done();
        });
      });
    }); // end 'basic name resolution'


    it('should appropriately resolves names given remote address', function (done) {
      done(new Error('Not tested.'));
    });

    it('should return an error if all names errored when querying the api', function (done) {
      done(new Error('Not tested.'));
    });

    it('should return a result if at least one name resolves without error', function (done) {
      done(new Error('Not tested.'));
    });


  }); // end '.resolve()'
});

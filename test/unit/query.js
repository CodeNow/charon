'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var after = lab.after;
var afterEach = lab.afterEach;
var Code = require('code');
var expect = Code.expect;
var dns = require('native-dns');
var sinon = require('sinon');
var createCount = require('callback-count');

require('loadenv')('charon:env');
var query = require('../../lib/query');
var cache = query.getCache();
var apiClient = require('../../lib/api-client');
var monitor = require('monitor-dog');
var monitorStub = require('../fixtures/monitor');
var pubsub = require('../../lib/pubsub');

describe('query', function() {
  describe('interface', function() {
    it('should expose the resolve method', function (done) {
      expect(query.resolve).to.exist();
      expect(typeof query.resolve).to.equal('function');
      done();
    });
  }); // end 'interface'

  describe('.resolve()', function() {
    describe('api integration', function() {
      beforeEach(function (done) {
        sinon.stub(apiClient.user, 'fetchInternalIpForHostname')
          .yields(null, '10.0.0.1');
        done();
      });

      afterEach(function (done) {
        apiClient.user.fetchInternalIpForHostname.restore();
        done();
      });

      after(function (done) {
        cache.reset();
        done();
      });

      it('should ask the api to resolve a single domain name', function (done) {
        query.resolve('127.0.0.1', ['tottttes.runnableapp.com'], function (err, records) {
          expect(apiClient.user.fetchInternalIpForHostname.calledOnce).to.be.true();
          done();
        });
      });

      it('should ask the api to resolve multiple given domain names', function (done) {
        var names = [
          'web-codenow.runnableapp.com',
          'api-codenow.runnableapp.com',
          'example-boooomm.runnableapp.com'
        ];
        query.resolve('127.0.0.1', names, function (err, records) {
          expect(apiClient.user.fetchInternalIpForHostname.callCount).to.equal(names.length);
          done();
        });
      });
    });

    describe('basic name resolution', function() {
      before(function (done) {
        sinon.stub(apiClient.user, 'fetchInternalIpForHostname', function(name, address, cb) {
          var response = null;
          if (address == '127.0.0.1') {
            response = '10.0.0.1';
          }
          else if (address == '127.0.0.2') {
            response = '10.0.0.2';
          }
          cb(null, response);
        });
        done();
      });

      after(function (done) {
        apiClient.user.fetchInternalIpForHostname.restore();
        cache.reset();
        done();
      });

      it('should resolve internal domain names', function (done) {
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

      it('should not resolve external domain names', function (done) {
        var names = [
          'www.google.com',
          'www.wikipedia.org',
          'www.ign.com'
        ];
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(records).to.be.null();
          done();
        });
      });

      it('should not resolve domain names that contain the filter but are external', function (done) {
        var names = [
          'runnableapp.com.woza.com',
          'www.runnableapp.com.neat.com',
          'indeed.neat.runnable.com.app.com'
        ];
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(records).to.be.null();
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

      it('should set the appropriate TTL', function (done) {
        var names = ['example.runnableapp.com'];
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(records.length).to.equal(1);
          expect(records[0].ttl).to.equal(process.env.DEFAULT_TTL);
          done();
        });
      });

      it('should appropriately resolves names given remote address', function (done) {
        var count = createCount(3, done);
        var names = ['example-skldkkdnndkkslllll.runnableapp.com'];

        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(records.length).to.equal(1);
          expect(records[0].name).to.equal(names[0]);
          expect(records[0].address).to.equal('10.0.0.1');
          count.next();
        });

        query.resolve('127.0.0.2', names, function (err, records) {
          if (err) { return done(err); }
          expect(records.length).to.equal(1);
          expect(records[0].name).to.equal(names[0]);
          expect(records[0].address).to.equal('10.0.0.2');
          count.next();
        });

        query.resolve('127.0.0.3', names, function (err, records) {
          if (err) { return done(err); }
          expect(records.length).to.equal(0);
          count.next();
        });
      });
    }); // end 'basic name resolution'

    describe('errors', function() {
      before(function (done) {
        sinon.stub(apiClient.user, 'fetchInternalIpForHostname', function(name, address, cb) {
          if (name == 'valid.runnableapp.com') {
            return cb(null, '10.0.0.1');
          }
          cb(new Error('API Error'));
        });
        done();
      });

      after(function (done) {
        apiClient.user.fetchInternalIpForHostname.restore();
        cache.reset();
        done();
      });

      it('should return an error if all names errored when querying the api', function (done) {
        var names = [
          'a.runnableapp.com',
          'b.runnableapp.com',
          'c.runnableapp.com'
        ];
        query.resolve('127.0.0.1', names, function (err, records) {
          expect(err).to.exist();
          expect(records).to.be.null();
          done();
        });
      });

      it('should return a result if at least one name resolves without error', function (done) {
        var names = [
          'a.runnableapp.com',
          'b.runnableapp.com',
          'valid.runnableapp.com'
        ];
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(records).to.exist();
          expect(records.length).to.equal(1);
          done();
        });
      });
    }); // end 'errors'

    describe('monitoring', function() {
      beforeEach(function (done) {
        sinon.stub(apiClient.user, 'fetchInternalIpForHostname')
          .yields(null, '10.0.0.1');
        monitorStub.stubAll();
        done();
      });

      afterEach(function (done) {
        monitorStub.restoreAll();
        apiClient.user.fetchInternalIpForHostname.restore();
        done();
      });

      after(function (done) {
        cache.reset();
        done();
      });

      it('should monitor number of lookups per query', function (done) {
        var names = [
          'a.runnableapp.com',
          'b.runnableapp.com',
          'c.runnableapp.com'
        ];
        var lookups = names.length;
        var stub = monitor.histogram;
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(stub.calledWith('lookups.per.query', lookups)).to.be.true();
          done();
        });
      });

      it('should monitor individual lookups', function (done) {
        var names = ['snwlldkks.runnableapp.com'];
        var stub = monitor.increment;
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(stub.calledWith('lookup')).to.be.true();
          done();
        });
      });

      it('should monitor lookup time', function (done) {
        var names = ['sssssssa.runnableapp.com'];
        var stub = monitor.histogram;
        query.resolve('127.0.0.1', names, function (err, records) {
          if (err) { return done(err); }
          expect(stub.calledWith('lookup.time')).to.be.true();
          done();
        });
      });

      it('should monitor lookup errors', function (done) {
        apiClient.user.fetchInternalIpForHostname.restore();
        sinon.stub(apiClient.user, 'fetchInternalIpForHostname')
          .yields(new Error('API Error'));
        var names = ['asppsppsppsppsddd.runnableapp.com'];
        var stub = monitor.increment;
        query.resolve('127.0.0.1', names, function (err, records) {
          expect(stub.calledWith('error.lookup')).to.be.true();
          done();
        });
      });

      it('should monitor cache misses', function(done) {
        var address = '127.0.0.2';
        var names = ['cache-miss.runnableapp.com'];
        var stub = monitor.increment;
        query.resolve(address, names, function(err, records) {
          expect(stub.calledWith('cache.miss')).to.be.true();
          done();
        });
      });

      it('should monitor cache hits', function(done) {
        var address = '127.0.0.1';
        var names = ['cache-hit.runnableapp.com'];
        var stub = monitor.increment;
        query.resolve(address, names, function(err, records) {
          if (err) { return done(err); }
          query.resolve(address, names, function (err, records) {
            expect(stub.calledWith('cache.hit')).to.be.true();
            done();
          });
        });
      });

      it('should monitor cache sets', function(done) {
        var address = '127.0.0.3';
        var names = ['cache-set.runnableapp.com'];
        var stub = monitor.increment;
        query.resolve(address, names, function(err, records) {
          expect(stub.calledWith('cache.set')).to.be.true();
          done();
        });
      });

      it('should monitor cache invalidations', function(done) {
        pubsub.emit(process.env.REDIS_INVALIDATION_KEY, '127.0.0.3');
        expect(monitor.increment.calledWith('cache.invalidate')).to.be.true();
        done();
      });
    }); // end 'monitoring'

    describe('caching', function() {
      beforeEach(function (done) {
        cache.reset();
        sinon.spy(cache, 'set');
        sinon.stub(apiClient.user, 'fetchInternalIpForHostname')
          .yields(null, '10.0.0.4');
        done();
      });

      afterEach(function (done) {
        cache.set.restore();
        apiClient.user.fetchInternalIpForHostname.restore();
        done();
      });

      it('should set cache results from api responses on miss', function(done) {
        var address = '127.0.0.3';
        var names = ['cache-set.runnableapp.com'];
        var cacheKey = { name: names[0], address: address };
        query.resolve(address, names, function (err, records) {
          if (err) { return done(err); }
          expect(apiClient.user.fetchInternalIpForHostname.calledOnce)
            .to.be.true();
          expect(cache.set.calledOnce).to.be.true();
          expect(cache.set.firstCall.args[0]).to.deep.equal(cacheKey);
          expect(cache.set.firstCall.args[1]).to.deep.equal(records[0]);
          expect(cache.get(cacheKey)).to.equal(records[0]);
          done();
        });
      });

      it('should use cached responses on hit', function(done) {
        var address = '127.0.0.3';
        var names = ['cache-set.runnableapp.com'];
        var cacheKey = { name: names[0], address: address };
        var cacheValue = { name: names[0], address: '10.0.0.1' };
        cache.set(cacheKey, cacheValue);

        query.resolve(address, names, function (err, records) {
          if (err) { return done(err); }
          expect(apiClient.user.fetchInternalIpForHostname.callCount)
            .to.equal(0);
          expect(records[0]).to.equal(cacheValue);
          done();
        });
      });

      it('should invalidate correct cache entries on pubsub event', function(done) {
        var address = '127.0.0.3';
        var hostIps = ['10.0.0.1', '10.0.0.2', '10.0.0.3'];
        var names = ['cache-inv1.com', 'cache-inv2.com', 'cache-inv3.com'];

        // Set fake entries directly into the cache
        names.forEach(function (name, index) {
          var cacheKey = { name: name, address: address };
          var cacheValue = { name: name, address: hostIps[index] };
          cache.set(cacheKey, cacheValue);
        });

        // Ensure cache values are set before the invalidate
        names.forEach(function (name) {
          var cacheKey = { name: name, address: address };
          expect(cache.get(cacheKey), "name=" + name)
            .to.not.be.undefined();
        });

        pubsub.emit(process.env.REDIS_INVALIDATION_KEY, '127.0.0.3');

        // Check if they are gone after the invalidate
        names.forEach(function (name) {
          expect(cache.get({ address: address, name: name }), "name=" + name)
            .to.be.undefined();
        });

        done();
      });
    }); // end 'caching'

  }); // end '.resolve()'
}); // end 'query'

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
var noop = require('101/noop');
var os = require('os');
var debug = require('debug');
var rewire = require('rewire');

require('loadenv')('charon:env');
var ClusterManager = require('../../lib/cluster-man');

describe('cluster-man', function () {
  describe('module', function () {
    it('should expose the ClusterManager class', function (done) {
      expect(ClusterManager).to.exist();
      expect(typeof ClusterManager).to.equal('function');
      done();
    });
  }); // end 'module'

  describe('constructor', function (done) {
    it('should throw an execption if worker function is missing', function (done) {
      expect(function() {
        new ClusterManager();
      }).to.throw(Error, 'Cluster must be provided with a worker closure.');
      expect(function() {
        new ClusterManager({ master: function() {} });
      }).to.throw(Error, 'Cluster must be provided with a worker closure.');
      done();
    });

    it('should correctly assign a worker function', function (done) {
      var manager = new ClusterManager({ worker: noop });
      expect(manager.options.worker).to.equal(noop);
      done();
    });

    it('should allow construction with only the worker function', function (done) {
      var manager = new ClusterManager(noop);
      expect(manager.options.worker).to.equal(noop);
      done();
    });

    it('should default the master callback to noop', function (done) {
      var manager = new ClusterManager(function() { return 'worker'; });
      expect(manager.options.master).to.equal(noop);
      done();
    });

    it('should set the master function based on passed options', function (done) {
      var master = function() { return 'master'; };
      var manager = new ClusterManager({
        worker: noop,
        master: master
      });
      expect(manager.options.master).to.equal(master);
      done();
    });

    it('should use `CLUSTER_WORKERS` for `numWorkers`', function (done) {
      var manager = new ClusterManager(noop);
      expect(manager.options.numWorkers).to.equal(process.env.CLUSTER_WORKERS);
      done();
    });

    it('should use # of CPUs for `numWorkers` if `CLUSTER_WORKERS` is missing', function (done) {
      var envClusterWorkers = process.env.CLUSTER_WORKERS;
      delete process.env.CLUSTER_WORKERS;
      var manager = new ClusterManager(noop);
      expect(manager.options.numWorkers).to.equal(os.cpus().length);
      process.env.CLUSTER_WORKERS = envClusterWorkers;
      done();
    });

    it('should set `numWorkers` based on passed option', function (done) {
      var workers = 1337;
      var manager = new ClusterManager({ worker: noop, numWorkers: workers });
      expect(manager.options.numWorkers).to.equal(workers);
      done();
    });

    it('should use `CLUSTER_DEBUG` by default for debug scope', function(done) {
      var scope = process.env.CLUSTER_DEBUG;
      var spy = sinon.spy(ClusterManager.prototype, '_addLogger');
      var manager = new ClusterManager(noop);
      expect(spy.calledWith('info', scope + ':info')).to.be.true();
      expect(spy.calledWith('warning', scope + ':warning')).to.be.true();
      expect(spy.calledWith('error', scope + ':error')).to.be.true();
      ClusterManager.prototype._addLogger.restore();
      done();
    });

    it('should use `cluster-man` as a debug scope if `CLUSTER_DEBUG` is missing', function (done) {
      var envClusterDebug = process.env.CLUSTER_DEBUG;
      delete process.env.CLUSTER_DEBUG;
      var scope = 'cluster-man';
      var spy = sinon.spy(ClusterManager.prototype, '_addLogger');
      var manager = new ClusterManager(noop);
      expect(spy.calledWith('info', scope + ':info')).to.be.true();
      expect(spy.calledWith('warning', scope + ':warning')).to.be.true();
      expect(spy.calledWith('error', scope + ':error')).to.be.true();
      process.env.CLUSTER_DEBUG = envClusterDebug;
      ClusterManager.prototype._addLogger.restore();
      done();
    });

    it('should set debug scope based on passed options', function (done) {
      var scope = 'custom-scope';
      var spy = sinon.spy(ClusterManager.prototype, '_addLogger');
      var manager = new ClusterManager({
        worker: noop,
        debugScope: scope
      });
      expect(spy.calledWith('info', scope + ':info')).to.be.true();
      expect(spy.calledWith('warning', scope + ':warning')).to.be.true();
      expect(spy.calledWith('error', scope + ':error')).to.be.true();
      ClusterManager.prototype._addLogger.restore();
      done();
    });
  }); // end 'constructor'

  describe('start', function() {
    // TODO Write me
  });
}); // end 'cluster-man'

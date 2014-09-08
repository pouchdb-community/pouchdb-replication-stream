/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb');
//var Readable = require('stream').Readable;
//var Writable = require('stream').Writable;

//
// your plugin goes here
//
var replicationStream = require('../');
Pouch.plugin(replicationStream.plugin);
Object.keys(replicationStream.adapters).forEach(function (adapterName) {
  var adapter = replicationStream.adapters[adapterName];
  Pouch.adapter(adapterName, adapter);
});
var random = require('random-document-stream');

var noms = require('noms');
var chai = require('chai');
chai.use(require("chai-as-promised"));
var through = require('through2').obj;
//
// more variables you might want
//
chai.should(); // var should = chai.should();

var dbs;
if (process.browser) {
  dbs = 'testdb' + Math.random() +
    ',http://localhost:5984/testdb' + Math.round(Math.random() * 100000);
} else {
  dbs = process.env.TEST_DB;
}
var origN = 180;
dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function tests(dbName, dbType) {

  var db;
  var remote;

  beforeEach(function () {
    db = new Pouch(dbName);
    return db.then(function () {
      remote = new Pouch(dbName + '_remote');
      return remote.then(function () {});
    });
  });

  afterEach(function () {
    return db.destroy().then(function () {
      return remote.destroy();
    });
  });
  describe(dbType + ': hello test suite', function () {
    origN += 20;
    var n = origN;
    var out = [];
   
    var stream = through(function (chunk, _, next) {
      out.push(chunk);
      next();
    });
    var outStream = noms(function (next) {
      out.forEach(function (item) {
        this.push(item);
      }, this);
      next(null, null);
    });
    it('should dump a basic db', function (done) {
      random(n).pipe(db.createWriteStream()).on('finish', function () {
        db.dump(stream).then(function () {
          out.map(function (item, i) {
            if (!i) {
              return 1;
            }
            var out = JSON.parse(item);
            return out.docs.length;
          }).reduce(function (a, b) {
            return a + b;
          }).should.equal(n + 1, n + ' docs dumped plus meta data');
          done();
        }).catch(done);
      });
    });
    it('should load a basic db', function (done) {
      return remote.load(outStream).then(function () {
        return remote.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(n, n + ' docs replicated');
        done();
      }).catch(done);
    });
  });

}

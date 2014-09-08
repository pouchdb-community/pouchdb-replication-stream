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

    it('should dump and load a basic db', function () {

      var out = [];

      var stream = through(function (chunk, _, next) {
        out.push(chunk);
        next(null, chunk);
      });
      db.dump(stream).then(function () {
        out.should.have.length(3, '3 docs dumped');
        return remote.load(stream);
      }).then(function () {
        return remote.allDocs();
      }).then(function (res) {
        res.rows.should.have.length(3, '3 docs replicated');
      });
    });
  });

}

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
chai.should();
var Promise = require('bluebird');
var MemoryStream = require('memorystream');

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
  var out;
  var stream;
  var outStream;

  beforeEach(function () {
    this.timeout(30000);
    out = [];
    stream = through(function (chunk, _, next) {
      out.push(chunk);
      next();
    });
    outStream = noms(function (next) {
      out.forEach(function (item) {
        this.push(item);
      }, this);
      next(null, null);
    });
    db = new Pouch(dbName);
    return db.then(function () {
      remote = new Pouch(dbName + '_remote');
      return remote.then(function () {});
    });
  });

  afterEach(function () {
    this.timeout(30000);
    return db.destroy().then(function () {
      return remote.destroy();
    });
  });

  describe(dbType + ': test suite', function () {
    this.timeout(30000);

    it('should dump and load a basic db', function (done) {
      var n = 180;
      random(n).pipe(db.createWriteStream()).on('finish', function () {
        db.dump(stream).then(function () {
          out.map(function (item, i) {
            if (!i) {
              return 1;
            }
            var out = JSON.parse(item);
            return out.docs ? out.docs.length : 0;
          }).reduce(function (a, b) {
            return a + b;
          }).should.equal(n + 1, n + ' docs dumped plus meta data');
        }).then(function () {
          return remote.load(outStream);
        }).then(function () {
          return remote.allDocs();
        }).then(function (res) {
          res.rows.should.have.length(n, n + ' docs replicated');
          done();
        }).catch(done);
      });
    });

    it('should dump and load an empty db', function (done) {
      var n = 0;
      random(n).pipe(db.createWriteStream()).on('finish', function () {
        db.dump(stream).then(function () {
          out.map(function (item, i) {
            if (!i) {
              return 1;
            }
            var out = JSON.parse(item);
            return out.docs ? out.docs.length : 0;
          }).reduce(function (a, b) {
            return a + b;
          }).should.equal(n + 1, n + ' docs dumped plus meta data');
        }).then(function () {
          return remote.load(outStream);
        }).then(function () {
          return remote.allDocs();
        }).then(function (res) {
          res.rows.should.have.length(n, n + ' docs replicated');
          done();
        }).catch(done);
      });
    });

    it('should dump with seqs', function (done) {
      var lastSeq;
      random(180).pipe(db.createWriteStream()).on('finish', function () {
        db.dump(stream).then(function () {
          out.forEach(function (item) {
            item = JSON.parse(item);
            if (item.seq) {
              lastSeq = item.seq;
            }
          });
          lastSeq.should.equal(180);
          done();
        }).catch(done);
      });
    });

    it('should replicate same _revs into the dest db', function () {

      var stream = new MemoryStream();

      return db.bulkDocs([
        {_id: 'testdoc1'},
        {_id: 'testdoc2'}
      ]).then(function () {
        return Promise.all([
          db.dump(stream),
          remote.load(stream)
        ]);
      }).then(function () {
        return Promise.all([
          db.allDocs(),
          remote.allDocs()
        ]);
      }).then(function (docs) {
        var testdoc1_revs = [];
        var testdoc2_revs = [];
        testdoc1_revs.push(docs[0].rows[0].value.rev);
        testdoc1_revs.push(docs[1].rows[0].value.rev);
        testdoc2_revs.push(docs[0].rows[1].value.rev);
        testdoc2_revs.push(docs[1].rows[1].value.rev);
        testdoc1_revs[0].should.equal(testdoc1_revs[1]);
        testdoc2_revs[0].should.equal(testdoc2_revs[1]);
      });
    });

    it('should replicate using since/batch_size 1', function () {
      var stream = new MemoryStream();

      return db.put({_id: 'testdoc1'}).then(function () {
        return db.put({_id: 'testdoc2'});
      }).then(function () {
        return Promise.all([
          db.dump(stream, {
            since: 1,
            batch_size: 1
          }),
          remote.load(stream)
        ]);
      }).then(function () {
        return remote.allDocs();
      }).then(function (docs) {
        docs.rows.should.have.length(1);
        docs.rows[0].id.should.equal('testdoc2');
      });
    });

    it('should replicate using since/batch_size 2', function () {
      var stream = new MemoryStream();

      return db.put({_id: 'testdoc1'}).then(function () {
        return db.put({_id: 'testdoc2'});
      }).then(function () {
        return Promise.all([
          db.dump(stream, {
            since: 1,
            batch_size: 100
          }),
          remote.load(stream)
        ]);
      }).then(function () {
        return remote.allDocs();
      }).then(function (docs) {
        docs.rows.should.have.length(1);
        docs.rows[0].id.should.equal('testdoc2');
      });
    });

    it('should dump to a string', function () {

      var concat = require('concat-stream');

      var dumpedString = '';
      var readStream = concat({encoding: 'string'}, function (line) {
        dumpedString += line;
      });

      return db.put({_id: '1'}).then(function () {
        return db.dump(readStream);
      }).then(function () {
        dumpedString.should.be.a('string', 'got a string');
      });
    });

  });

}

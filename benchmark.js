var Promise = require('bluebird');
var PouchDB = require('pouchdb');
var replicationStream = require('./index');
var MemoryStream = require('memorystream');
var Chance = require('chance');

var benchmark = module.exports = function(options) {

  PouchDB.plugin(replicationStream.plugin);
  PouchDB.adapter('writableStream', replicationStream.adapters.writableStream);
  var chance = new Chance();

  var testDB = options.db || 'http://localhost:5984/stream_benchmark';
  var num_records = options.records || 500;
  var batch_size = options.batch || 100;

  var remote = new PouchDB(testDB);
  var remote2 = new PouchDB(testDB + '_2');
  var remote3 = new PouchDB(testDB + '_3');
  var local1 = new PouchDB('stream_benchmark1');
  var local2 = new PouchDB('stream_benchmark2');

  var normal_start1, normal_final1, normal_start2, normal_final2, stream_start1, stream_final1, stream_start2, stream_final2,
    normal_total, stream_total, results;

  function prep() {
    console.log('Connecting to database: ' + testDB);
    console.log('Generating ' + num_records + ' records, batch size: ' + batch_size);
    console.log('Preparing database');
    return remote.bulkDocs(random(num_records));
  }

  function normalReplication1() {
    return new Promise(function(resolve, reject) {
      console.log('Normal replication from remote to local');
      normal_start1 = Date.now();
      local1.replicate.from(remote, {batch_size: batch_size})
        .on('complete', function() {
          normal_final1 = Date.now() - normal_start1;
          resolve();
        })
        .on('error', function(err) {
          reject(err);
        });
    });
  }

  function normalReplication2() {
    return new Promise(function(resolve, reject) {
      console.log('Normal replication from local to remote');
      normal_start2 = Date.now();
      remote2.replicate.from(local1, {batch_size: batch_size})
        .on('complete', function() {
          normal_final2 = Date.now() - normal_start2;
          resolve();
        })
        .on('error', function(err) {
          reject(err);
        });
    });
  }

  function streamReplication1() {
    console.log('Stream replication from remote to local');
    var stream = new MemoryStream();
    stream_start1 = Date.now();
    return Promise.all([
      remote.dump(stream, {batch_size: batch_size}),
      local2.load(stream, {batch_size: batch_size})
    ])
      .then(function() {
        stream_final1 = Date.now() - stream_start1;
      });
  }

  function streamReplication2() {
    console.log('Stream replication from local to remote');
    var stream = new MemoryStream();
    stream_start2 = Date.now();
    return Promise.all([
      local1.dump(stream, {batch_size: batch_size}),
      remote3.load(stream, {batch_size: batch_size})
    ])
      .then(function() {
        stream_final2 = Date.now() - stream_start2;
      });
  }

  prep()
    .then(function() {
      return normalReplication1();
    })
    .then(function() {
      return normalReplication2();
    })
    .then(function() {
      return streamReplication1();
    })
    .then(function() {
      return streamReplication2();
    })
    .then(function() {
      normal_total = normal_final1 + normal_final2;
      stream_total = stream_final1 + stream_final2;
      console.log('Normal replication: ' + normal_final1 + ' + ' + normal_final2 + ' = ' + normal_total + 'ms' );
      console.log('Stream replication: ' + stream_final1 + ' + ' + stream_final2 + ' = ' + stream_total + 'ms' );
      var verdict = (stream_total < normal_total) ? 'faster' : 'slower';
      var winner = (stream_total < normal_total) ? 'stream' : 'normal';
      var diff = Math.abs((stream_total - normal_total) / normal_total * 100).toFixed(2);
      console.log('Stream replication is ' + diff + '% ' + verdict + ' than normal replication');
      results = {
        db: testDB,
        records: num_records,
        batch: batch_size,
        normal: {
          fromRemote: normal_final1,
          fromLocal: normal_final2,
          total: normal_total
        },
        stream: {
          fromRemote: stream_final1,
          fromLocal: stream_final2,
          total: stream_total
        },
        winner: winner,
        difference: diff
      };
      return cleanup();
    })
    .then(function() {
      return Promise.resolve(results);
    })
    .catch(function(err) {
      console.log(err);
      return cleanup();
    });

  function random (n) {
    var output = [];
    for(var i=0;i<n;i++) {
      output.push(makeJunk());
    }
    return output;
  }

  function makeJunk () {
    return {
      name: chance.name({
        middle_initial: true,
        prefix: true
      }),
      description: chance.sentence(),
      address: chance.address(),
      _id: chance.guid()
    };
  }

  function cleanup() {
    return Promise.all([
      remote.destroy(),
      remote2.destroy(),
      remote3.destroy(),
      local1.destroy(),
      local2.destroy()
    ]);
  }

};

// Test if we are running from the command line
if(require.main === module) {
  var argv = require('minimist')(process.argv.slice(2));
  benchmark(argv);
}
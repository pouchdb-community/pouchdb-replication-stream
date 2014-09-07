'use strict';

var utils = require('./pouch-utils');
var version = require('./version');
var split = require('split');

exports.adapters = {};
//exports.adapters.readableStream = require('./readable-stream');
exports.adapters.writableStream = require('./writable-stream');

exports.plugin = {};

exports.plugin.dump = utils.toPromise(function (writableStream, opts, callback) {
  var self = this;
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  var PouchDB = self.constructor;

  var output = new PouchDB(self._db_name, {
    stream: writableStream,
    adapter: 'writableStream'
  });

  self.info().then(function (info) {
    var header = {
      version: version,
      db_type: self.type(),
      start_time: new Date().toJSON(),
      db_info: info
    };
    writableStream.write(JSON.stringify(header) + '\n');
  }).then(function () {
    var replicationOpts = {};
    if ('batch_size' in opts) {
      replicationOpts.batch_size = opts.batch_size;
    }
    return self.replicate.to(output, replicationOpts);
  }).then(function () {
    return output.close();
  }).then(function () {
    callback(null, {ok: true});
  }).catch(function (err) {
    callback(err);
  });
});

exports.plugin.load = utils.toPromise(function (readableStream, opts, callback) {
  var self = this;
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  var queue = utils.Promise.resolve();

  readableStream.pipe(split()).on('data', function (line) {
    if (!line) {
      queue = queue.then(function () {
        callback(null, {ok: true});
      });
      return;
    }
    var data = JSON.parse(line);
    if (!data.docs) {
      return;
    }
    queue = queue.then(function () {
      return self.bulkDocs({docs: data.docs, new_edits: false});
    });
  }).on('error', function (err) {
    queue = queue.then(function () {
      callback(err);
    });
  });
});

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports.plugin);
  //window.PouchDB.adapter('readableStream', exports.adapters.readableStream);
  window.PouchDB.adapter('writableStream', exports.adapters.writableStream);
}

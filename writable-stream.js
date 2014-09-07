'use strict';

var utils = require('./pouch-utils');

var ERROR_REV_CONFLICT = {
  status: 409,
  name: 'conflict',
  message: 'Document update conflict'
};

var ERROR_MISSING_DOC = {
  status: 404,
  name: 'not_found',
  message: 'missing'
};

function WritableStreamPouch(opts, callback) {
  var api = this;
  var instanceId = Math.random().toString();
  var stream = opts.stream;
  var localStore = {};

  api.type = function () {
    return 'readable-stream';
  };

  api._id = utils.toPromise(function (callback) {
    callback(null, instanceId);
  });

  api._bulkDocs = function (req, opts, callback) {
    var docs = req.docs;

    if (opts.new_edits === false) {
      // assume we're only getting this with new_edits=false,
      // since this adapter is just a replication target
      stream.write(JSON.stringify({docs: docs}) + '\n');
      process.nextTick(function () {
        callback(null, docs.map(function (doc) {
          return {
            ok: true,
            id: doc._id,
            rev: doc._rev
          };
        }));
      });
    } else {
      // writing local docs for replication
      utils.Promise.all(docs.map(function (doc) {
        localStore[doc._id] = doc;
      })).then(function (res) {
        callback(null, res);
      }).catch(function (err) {
        callback(err);
      });
    }
  };

  api._getRevisionTree = function (docId, callback) {
    process.nextTick(function () {
      callback(ERROR_MISSING_DOC);
    });
  };

  api._close = function (callback) {
    stream.end();
    callback();
  };

  api._getLocal = function (id, callback) {
    process.nextTick(function () {
      var existingDoc = localStore[id];
      if (existingDoc) {
        callback(null, existingDoc);
      } else {
        callback(ERROR_MISSING_DOC);
      }
    });
  };

  api._putLocal = function (doc, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    delete doc._revisions; // ignore this, trust the rev
    var oldRev = doc._rev;
    var id = doc._id;
    var newRev;
    if (!oldRev) {
      newRev = doc._rev = '0-1';
    } else {
      newRev = doc._rev = '0-' + (parseInt(oldRev.split('-')[1], 10) + 1);
    }

    process.nextTick(function () {
      var existingDoc = localStore[id];
      if (existingDoc && oldRev !== existingDoc._rev) {
        callback(ERROR_REV_CONFLICT);
      } else {
        localStore[id] = doc;
        callback(null, {ok: true, id: id, rev: newRev});
      }
    });
  };

  api._removeLocal = function (doc, callback) {
    process.nextTick(function () {
      var existingDoc = localStore[doc._id];
      if (existingDoc && doc._rev !== existingDoc._rev) {
        callback(ERROR_REV_CONFLICT);
      } else {
        delete localStore[doc._id];
        callback(null, {ok: true, id: doc._id, rev: '0-0'});
      }
    });
  };

  process.nextTick(function () {
    callback(null, api);
  });
}

WritableStreamPouch.valid = function () {
  return true;
};

WritableStreamPouch.destroy = utils.toPromise(function (name, opts, callback) {
  WritableStreamPouch.Changes.removeAllListeners(name);
  process.nextTick(function () {
    callback(null, {'ok': true});
  });
});

//WritableStreamPouch.Changes = new utils.Changes();

module.exports = WritableStreamPouch;

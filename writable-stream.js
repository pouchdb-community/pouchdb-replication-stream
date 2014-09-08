'use strict';

var utils = require('./pouch-utils');
var Transform = require('readable-stream').Transform;
var inherits = require('inherits');
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
inherits(WritableStreamPouch, Transform);
function WritableStreamPouch(opts, callback) {
  Transform.call(this, {objectMode: true});
  this.instanceId = Math.random().toString();
  this.stream = opts.stream;
  this.pipe(this.stream);
  this.localStore = {};
  var self = this;
  process.nextTick(function () {
    callback(null, self);
  });
}
WritableStreamPouch.prototype.type = function () {
  return 'readable-stream';
};

WritableStreamPouch.prototype._id = utils.toPromise(function (callback) {
  callback(null, this.instanceId);
});

WritableStreamPouch.prototype._bulkDocs = function (req, opts, callback) {
  var docs = req.docs;
  var self = this;
  if (opts.new_edits === false) {
    // assume we're only getting this with new_edits=false,
    // since this adapter is just a replication target
    this.write(docs);
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
      self.localStore[doc._id] = doc;
    })).then(function (res) {
      callback(null, res);
    }).catch(function (err) {
      callback(err);
    });
  }
};
WritableStreamPouch.prototype._transform = function (chunk, _, next) {
  this.push('{"docs":');
  this.push(JSON.stringify(chunk));
  this.push('}\n');
  next();
};
WritableStreamPouch.prototype._getRevisionTree = function (docId, callback) {
  process.nextTick(function () {
    callback(ERROR_MISSING_DOC);
  });
};

WritableStreamPouch.prototype._close = function (callback) {
  this.write(null, callback);
};

WritableStreamPouch.prototype._getLocal = function (id, callback) {
  var self = this;
  process.nextTick(function () {
    var existingDoc = self.localStore[id];
    if (existingDoc) {
      callback(null, existingDoc);
    } else {
      callback(ERROR_MISSING_DOC);
    }
  });
};

WritableStreamPouch.prototype._putLocal = function (doc, opts, callback) {
  var self = this;
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
    var existingDoc = self.localStore[id];
    if (existingDoc && oldRev !== existingDoc._rev) {
      callback(ERROR_REV_CONFLICT);
    } else {
      self.localStore[id] = doc;
      callback(null, {ok: true, id: id, rev: newRev});
    }
  });
};

WritableStreamPouch.prototype._removeLocal = function (doc, callback) {
  var self = this;
  process.nextTick(function () {
    var existingDoc = self.localStore[doc._id];
    if (existingDoc && doc._rev !== existingDoc._rev) {
      callback(ERROR_REV_CONFLICT);
    } else {
      delete self.localStore[doc._id];
      callback(null, {ok: true, id: doc._id, rev: '0-0'});
    }
  });
};


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

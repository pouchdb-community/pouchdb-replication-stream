'use strict';

var through = require('through2').obj;

module.exports = function () {
  return through(function (chunk, _, next) {
    if (!(chunk instanceof Buffer) && Buffer.isBuffer(chunk)) {
      chunk = new Buffer(chunk);
    }
    this.push(chunk);
    next();
  });
};

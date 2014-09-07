PouchDB Replication Stream
=====

[![Build Status](https://travis-ci.org/nolanlawson/pouchdb-replication-stream.svg)](https://travis-ci.org/nolanlawson/pouchdb-replication-stream)

`ReadableStream`s and `WritableStream`s for PouchDB/CouchDB replication. 

Basically, you can replicate two databases by just attaching the streams together.

This has many uses:

1. Dump a database to a file, and then load that same file into another database.
2. Do a quick initial replication by dumping the contents of a CouchDB to an HTTP endpoint, which is then loaded into a PouchDB in the browser.
3. Replicate over web sockets? Over bluetooth? Over NFC? Why not? Since the replication stream is just JSON plaintext, you can send it over any transport mechanism.
4. Periodically backup your database.

Usage
-------

Let's assume you have two databases. It doesn't matter whether they're remote or local:

```js
var db1 = new PouchDB('mydb');
var db2 = new PouchDB('http://localhost:5984/mydb');
```

Let's dump the entire contents of db1 to a file using `dump()`:

```js
var ws = fs.createWriteStream('output.txt');

db1.dump(ws).then(function (res) {
  // res should be {ok: true}
});
```

Now let's read that file into another database using `load()`:

```js
var rs = createReadStream('output.txt');

db2.load(ws).then(function (res) {
  // res should be {ok: true}
});
```

Design
----

The replication stream looks like this:

```js
{"version":"0.1.0","db_type":"leveldb","start_time":"2014-09-07T21:31:01.527Z","db_info":{"doc_count":3,"update_seq":3,"db_name":"testdb"}}
{"docs":[{"_id":"doc1","_rev":"1-20624ff392c68c359adb98504a369769","foo":"bar"}]}
{"docs":[{"_id":"doc2","_rev":"1-8b6f55822a3e3932ac1e9ddb8b0357cb","bar":"baz"}]}
{"docs":[{"_id":"doc3","_rev":"1-2567345aa745c1d85602add2689dc398","baz":"quux"}]
```

I.e. it's just NDJ - Newline Delimited JSON. Each line is a list of the documents to be loaded into the target database (using `bulkDocs()` with `{new_edits: false}`).

The first line is a header containing some basic info, like the number of documents in the database and the replication stream protocol version. Such info many be useful for showing a progress bar during the `load()` process, or for handling later versions, in case this protocol changes.

This replication stream is _idempotent_, meaning you can load it into a target database any number of times, and it will be as if you had only done it once.

At the end of the `load()` process, the target database will function exactly as if it had been replicated from the source database. Revision hashes, conflicts, attachments, and document contents are all faithfully transported.

Installation
--------

To use this plugin, include it after `pouchdb.js` in your HTML page:

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.replication-stream.js"></script>
```

Or to use it in Node.js, just npm install it:

```
npm install pouchdb-replication-stream
```

And then attach it to the `PouchDB` object using the following code:

```js
var PouchDB = require('pouchdb');
var replicationStream = require('pouchdb-replication-stream');

PouchDB.plugin(replicationStream.plugin);
PouchDB.adapter('writableStream', replicationStream.adapters.writableStream);
```

Building
----
    npm install
    npm run build

Your plugin is now located at `dist/pouchdb.mypluginname.js` and `dist/pouchdb.mypluginname.min.js` and is ready for distribution.

Testing
----

### In Node

This will run the tests in Node using LevelDB:

    npm test
    
You can also check for 100% code coverage using:

    npm run coverage

If you don't like the coverage results, change the values from 100 to something else in `package.json`, or add `/*istanbul ignore */` comments.


If you have mocha installed globally you can run single test with:
```
TEST_DB=local mocha --reporter spec --grep search_phrase
```

The `TEST_DB` environment variable specifies the database that PouchDB should use (see `package.json`).

### In the browser

Run `npm run dev` and then point your favorite browser to [http://127.0.0.1:8001/test/index.html](http://127.0.0.1:8001/test/index.html).

The query param `?grep=mysearch` will search for tests matching `mysearch`.

### Automated browser tests

You can run e.g.

    CLIENT=selenium:firefox npm test
    CLIENT=selenium:phantomjs npm test

This will run the tests automatically and the process will exit with a 0 or a 1 when it's done. Firefox uses IndexedDB, and PhantomJS uses WebSQL.

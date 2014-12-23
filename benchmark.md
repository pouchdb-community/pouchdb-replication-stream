PouchDB Replication Benchmark
=====

* See for yourself just how much streams can speed your replications!
* Experiment and find the perfect batch size for your database setup
* Works from the command line or from a script

The replication benchmark tests both normal and stream replication, remote to local and local to remote. You can specify the remote database URL, number of docs to replicate, and the batch size.

Usage
-----

### Command Line

Simply clone the repository and run:
`node benchmark --db [http://localhost:5984/stream_benchmark] --records [500] --batch [100]`

### Script

Simply require the script and execute it. The script will return a promise which will resolve with a results object if successful.

`benchmark([options])`

**Example:**

```js
var benchmark = require('pouchdb-replication-stream/benchmark');
benchmark().then(function (results) {
  console.log(results);
});
```

**Output**

```js
{
  db: 'http://localhost:5984/stream_benchmark',
  records: 1000,
  batch: 500,
  normal: { fromRemote: 805, fromLocal: 878, total: 1683 },
  stream: { fromRemote: 563, fromLocal: 609, total: 1172 },
  winner: 'stream',
  difference: '30.36'
}
```

**Available options:**

* `db`: The remote database to connect to, including the trailing database name (Default: `http://localhost:5984/stream_benchmark`)
* `records`: The number of docs to replicate in each phase of the benchmark (Default: 500)
* `batch`: The batch size to test (Default: 100)
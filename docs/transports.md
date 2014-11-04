# Firelog Transports

In `firelog` a transport is essentially a storage device for your logs. Each instance of a firelog logger can have multiple transports configured at different levels. For example, one may want error logs to be stored in a persistent remote location (like a database), but all logs output to the console or a local file.

There are several [core transports](#firelog-core) included in `firelog`, which leverage the built-in networking and file I/O offered by node.js core. In addition, there are [third-party transports which are supported by the firelog core team](#firelog-more). And last (but not least) there are [additional transports written by members of the community](#additional-transports).

* **[Firelog Core](#firelog-core)**
  * [Console](#console-transport)
  * [File](#file-transport)
  * [DailyRotateFile](#dailyrotatefile-transport)
  * [Http](#http-transport)
  * [Webhook](#webhook-transport)

* **[Firelog More](#firelog-more)**
  * [CouchDB](#couchdb-transport)
  * [Loggly](#loggly-transport)
  * [MongoDB](#mongodb-transport)
  * [Redis](#redis-transport)
  * [Riak](#riak-transport)
  
* **[Additional Transports](#additional-transports)**
  * [SimpleDB](#simpledb-transport)
  * [Mail](#mail-transport)
  * [Amazon SNS](#amazon-sns-simple-notification-system-transport)
  * [Graylog2](#graylog2-transport)

## Firelog Core

There are several core transports included in `firelog`, which leverage the built-in networking and file I/O offered by node.js core.

* [Console](#console-transport)
* [File](#file-transport)
* [DailyRotateFile](#dailyrotatefile-transport)
* [Http](#http-transport)
* [Webhook](#webhook-transport)

### Console Transport

``` js
  firelog.add(firelog.transports.Console, options)
```

The Console transport takes four simple options:

* __level:__ Level of messages that this transport should log (default 'debug').
* __silent:__ Boolean flag indicating whether to suppress output (default false).
* __colorize:__ Boolean flag indicating if we should colorize output (default false).
* __timestamp:__ Boolean flag indicating if we should prepend output with timestamps (default false). If function is specified, its return value will be used instead of timestamps.

*Metadata:* Logged via util.inspect(meta);

### File Transport

``` js
  firelog.add(firelog.transports.File, options)
```

The File transport should really be the 'Stream' transport since it will accept any [WritableStream][0]. It is named such because it will also accept filenames via the 'filename' option:

* __level:__ Level of messages that this transport should log.
* __silent:__ Boolean flag indicating whether to suppress output.
* __colorize:__ Boolean flag indicating if we should colorize output.
* __timestamp:__ Boolean flag indicating if we should prepend output with timestamps (default false). If function is specified, its return value will be used instead of timestamps.
* __filename:__ The filename of the logfile to write output to.
* __maxsize:__ Max size in bytes of the logfile, if the size is exceeded then a new file is created.
* __maxFiles:__ Limit the number of files created when the size of the logfile is exceeded.
* __stream:__ The WriteableStream to write output to.
* __json:__ If true, messages will be logged as JSON (default true).

*Metadata:* Logged via util.inspect(meta);

### DailyRotateFile Transport

``` js
  firelog.add(firelog.transports.DailyRotateFile, options)
```

The DailyRotateFile transport can rotate files by minute, hour, day, month or year. Its options are identical to the File transport with the lone addition of the 'datePattern' option:

* __datePattern:__ A string representing the pattern to be used when appending the date to the filename (default '.yyyy-MM-dd'). The meta characters used in this string will dictate the frequency of the file rotation. For example if your datePattern is simply '.HH' you will end up with 24 log files that are picked up and appended to every day.

Valid meta characters in the datePattern are:

* __yy:__ Last two digits of the year.
* __yyyy:__ Full year.
* __M:__ The month.
* __MM:__ The zero padded month.
* __d:__ The day.
* __dd:__ The zero padded day.
* __H:__ The hour.
* __HH:__ The zero padded hour.
* __m:__ The minute.
* __mm:__ The zero padded minute.

*Metadata:* Logged via util.inspect(meta);

### Http Transport

``` js
  firelog.add(firelog.transports.Http, options)
```

The `Http` transport is a generic way to log, query, and stream logs from an arbitrary Http endpoint, preferably [winstond][1]. It takes options that are passed to the node.js `http` or `https` request:

* __host:__ (Default: **localhost**) Remote host of the HTTP logging endpoint
* __port:__ (Default: **80 or 443**) Remote port of the HTTP logging endpoint
* __path:__ (Default: **/**) Remote URI of the HTTP logging endpoint 
* __auth:__ (Default: **None**) An object representing the `username` and `password` for HTTP Basic Auth
* __ssl:__ (Default: **false**) Value indicating if we should us HTTPS

## Firelog More

Starting with `firelog@0.3.0` an effort was made to remove any transport which added additional dependencies to `firelog`. At the time there were several transports already in `firelog` which will **always be supported by the firelog core team.**

* [CouchDB](#couchdb-transport)
* [Redis](#redis-transport)
* [MongoDB](#mongodb-transport)
* [Riak](#riak-transport)
* [Loggly](#loggly-transport)

### CouchDB Transport

_As of `firelog@0.6.0` the CouchDB transport has been broken out into a new module: [firelog-couchdb][2]._

``` js
  firelog.add(firelog.transports.Couchdb, options)
```

The `Couchdb` will place your logs in a remote CouchDB database. It will also create a [Design Document][3], `_design/Logs` for later querying and streaming your logs from CouchDB. The transport takes the following options:

* __host:__ (Default: **localhost**) Remote host of the HTTP logging endpoint
* __port:__ (Default: **5984**) Remote port of the HTTP logging endpoint
* __db:__ (Default: **firelog**) Remote URI of the HTTP logging endpoint
* __auth:__ (Default: **None**) An object representing the `username` and `password` for HTTP Basic Auth
* __ssl:__ (Default: **false**) Value indicating if we should us HTTPS

### Redis Transport

``` js
  firelog.add(firelog.transports.Redis, options)
```

This transport accepts the options accepted by the [node-redis][4] client:

* __host:__ (Default **localhost**) Remote host of the Redis server
* __port:__ (Default **6379**) Port the Redis server is running on.
* __auth:__ (Default **None**) Password set on the Redis server

In addition to these, the Redis transport also accepts the following options.

* __length:__ (Default **200**) Number of log messages to store.
* __container:__ (Default **firelog**) Name of the Redis container you wish your logs to be in.
* __channel:__ (Default **None**) Name of the Redis channel to stream logs from. 

*Metadata:* Logged as JSON literal in Redis

### Loggly Transport

_As of `firelog@0.6.0` the Loggly transport has been broken out into a new module: [firelog-loggly][5]._

``` js
  firelog.add(firelog.transports.Loggly, options);
```

The Loggly transport is based on [Nodejitsu's][6] [node-loggly][7] implementation of the [Loggly][8] API. If you haven't heard of Loggly before, you should probably read their [value proposition][9]. The Loggly transport takes the following options. Either 'inputToken' or 'inputName' is required:

* __level:__ Level of messages that this transport should log.
* __subdomain:__ The subdomain of your Loggly account. *[required]*
* __auth__: The authentication information for your Loggly account. *[required with inputName]*
* __inputName:__ The name of the input this instance should log to.
* __inputToken:__ The input token of the input this instance should log to.
* __json:__ If true, messages will be sent to Loggly as JSON.

*Metadata:* Logged in suggested [Loggly format][10]

### Riak Transport

_As of `firelog@0.3.0` the Riak transport has been broken out into a new module: [firelog-riak][11]._ Using it is just as easy:

``` js
  var Riak = require('firelog-riak').Riak;
  firelog.add(Riak, options);
```

In addition to the options accepted by the [riak-js][12] [client][13], the Riak transport also accepts the following options. It is worth noting that the riak-js debug option is set to *false* by default:

* __level:__ Level of messages that this transport should log.
* __bucket:__ The name of the Riak bucket you wish your logs to be in or a function to generate bucket names dynamically.

``` js
  // Use a single bucket for all your logs
  var singleBucketTransport = new (Riak)({ bucket: 'some-logs-go-here' });

  // Generate a dynamic bucket based on the date and level
  var dynamicBucketTransport = new (Riak)({
    bucket: function (level, msg, meta, now) {
      var d = new Date(now);
      return level + [d.getDate(), d.getMonth(), d.getFullYear()].join('-');
    }
  });
```

*Metadata:* Logged as JSON literal in Riak

### MongoDB Transport

As of `firelog@0.3.0` the MongoDB transport has been broken out into a new module: [firelog-mongodb][14]. Using it is just as easy:

``` js
  var MongoDB = require('firelog-mongodb').MongoDB;
  firelog.add(MongoDB, options);
```

The MongoDB transport takes the following options. 'db' is required:

* __level:__ Level of messages that this transport should log.
* __silent:__ Boolean flag indicating whether to suppress output.
* __db:__ The name of the database you want to log to. *[required]*
* __collection__: The name of the collection you want to store log messages in, defaults to 'log'.
* __safe:__ Boolean indicating if you want eventual consistency on your log messages, if set to true it requires an extra round trip to the server to ensure the write was committed, defaults to true.
* __host:__ The host running MongoDB, defaults to localhost.
* __port:__ The port on the host that MongoDB is running on, defaults to MongoDB's default port.

*Metadata:* Logged as a native JSON object.

## Additional Transports

The community has truly embraced `firelog`; there are over **23** firelog transports and over half of them are maintained by authors external to the firelog core team. If you want to check them all out, just search `npm`:

``` bash
  $ npm search firelog
```

**If you have an issue using one of these modules you should contact the module author directly**

### SimpleDB Transport

The [firelog-simpledb][15] transport is just as easy:

``` js
  var SimpleDB = require('firelog-simpledb').SimpleDB;
  firelog.add(SimpleDB, options);
```

The SimpleDB transport takes the following options. All items marked with an asterisk are required:

* __awsAccessKey__:* your AWS Access Key
* __secretAccessKey__:* your AWS Secret Access Key
* __awsAccountId__:* your AWS Account Id
* __domainName__:* a string or function that returns the domain name to log to
* __region__:* the region your domain resides in
* __itemName__: a string ('uuid', 'epoch', 'timestamp') or function that returns the item name to log

*Metadata:* Logged as a native JSON object to the 'meta' attribute of the item.

### Mail Transport

The [firelog-mail][16] is an email transport:

``` js
  var Mail = require('firelog-mail').Mail;
  firelog.add(Mail, options);
```

The Mail transport uses [node-mail][17] behind the scenes.  Options are the following, `to` and `host` are required:

* __to:__ The address(es) you want to send to. *[required]*
* __from:__ The address you want to send from. (default: `firelog@[server-host-name]`)
* __host:__ SMTP server hostname
* __port:__ SMTP port (default: 587 or 25)
* __secure:__ Use secure
* __username__ User for server auth
* __password__ Password for server auth
* __level:__ Level of messages that this transport should log.
* __silent:__ Boolean flag indicating whether to suppress output.

*Metadata:* Stringified as JSON in email.

### Amazon SNS (Simple Notification System) Transport

The [firelog-sns][18] transport uses amazon SNS to send emails, texts, or a bunch of other notifications.

``` js
  require('firelog-sns').SNS;
  firelog.add(firelog.transports.SNS, options);
```

Options:

* __aws_key:__ Your Amazon Web Services Key. *[required]*
* __aws_secret:__ Your Amazon Web Services Secret. *[required]*
* __subscriber:__ Subscriber number - found in your SNS AWS Console, after clicking on a topic. Same as AWS Account ID. *[required]*
* __topic_arn:__ Also found in SNS AWS Console - listed under a topic as Topic ARN. *[required]*
* __region:__ AWS Region to use. Can be one of: `us-east-1`,`us-west-1`,`eu-west-1`,`ap-southeast-1`,`ap-northeast-1`,`us-gov-west-1`,`sa-east-1`. (default: `us-east-1`)
* __subject:__ Subject for notifications. (default: "Firelog Error Report")
* __message:__ Message of notifications. Uses placeholders for level (%l), error message (%e), and metadata (%m). (default: "Level '%l' Error:\n%e\n\nMetadata:\n%m")
* __level:__ lowest level this transport will log. (default: `info`)

### Graylog2 Transport

[firelog-graylog2][19] is a Graylog2 transport:

``` js
  var Graylog2 = require('firelog-graylog2').Graylog2;
  firelog.add(Graylog2, options);
```

The Graylog2 transport connects to a Graylog2 server over UDP using the following options:

* __level:__ Level of messages this transport should log. (default: info)
* __silent:__ Boolean flag indicating whether to suppress output. (default: false)

* __graylogHost:__ IP address or hostname of the graylog2 server. (default: localhost)
* __graylogPort:__ Port to send messages to on the graylog2 server. (default: 12201)
* __graylogHostname:__ The hostname associated with graylog2 messages. (default: require('os').hostname())
* __graylogFacility:__ The graylog2 facility to send log messages.. (default: nodejs)

*Metadata:* Stringified as JSON in the full message GELF field.

### Cassandra Transport

[firelog-cassandra][20] is a Cassandra transport:

``` js
  var Cassandra = require('firelog-cassandra').Cassandra;
  firelog.add(Cassandra, options);
```

The Cassandra transport connects to a cluster using the native protocol with the following options:

* __level:__ Level of messages that this transport should log (default: `'info'`).
* __table:__ The name of the Cassandra column family you want to store log messages in (default: `'logs'`).
* __partitionBy:__ How you want the logs to be partitioned. Possible values `'hour'` and `'day'`(Default).
* __consistency:__ The consistency of the insert query (default: `quorum`).

In addition to the options accepted by the [Node.js Cassandra driver](https://github.com/jorgebay/node-cassandra-cql) Client.

* __hosts:__ Cluster nodes that will handle the write requests:
Array of strings containing the hosts, for example `['host1', 'host2']` (required).
* __keyspace:__ The name of the keyspace that will contain the logs table (required). The keyspace should be already created in the cluster.


## Find more Transports

``` bash
  $ npm search firelog
  (...)
  firelog-amon         Firelog transport for Amon logging                            =zoramite
  firelog-amqp         An AMQP transport for firelog                                 =kr1sp1n
  firelog-cassandra    A Cassandra transport for firelog                             =jorgebay
  firelog-couchdb      a couchdb transport for firelog                               =alz
  firelog-express      Express middleware to let you use firelog from the browser.   =regality
  firelog-graylog2     A graylog2 transport for firelog                              =smithclay
  firelog-hbase        A HBase transport for firelog                                 =ddude
  firelog-loggly       A Loggly transport for firelog                                =taoyuan
  firelog-mail         A mail transport for firelog                                  =wavded
  firelog-mail2        A mail transport for firelog                                  =ivolo
  firelog-mongodb      A MongoDB transport for firelog                               =taoyuan
  firelog-nodemail     A mail transport for firelog                                  =reinpk
  firelog-nssocket     nssocket transport for firelog                                =mmalecki
  firelog-papertrail   A Papertrail transport for firelog                            =kenperkins
  firelog-redis        A fixed-length Redis transport for firelog                    =taoyuan
  firelog-riak         A Riak transport for firelog                                  =taoyuan
  firelog-scribe       A scribe transport for firelog                                =wnoronha
  firelog-simpledb     A Firelog transport for Amazon SimpleDB                       =chilts
  firelog-skywriter    A Windows Azure table storage transport for firelog           =pofallon
  firelog-sns          A Simple Notification System Transport for firelog            =jesseditson
  firelog-syslog       A syslog transport for firelog                                =taoyuan
  firelog-syslog-ain2  An ain2 based syslog transport for firelog                    =lamtha
  firelog-winlog       Windows Event Log logger for Firelog                          =jfromaniello
  firelog-zmq          A 0MQ transport for firelog                                   =dhendo
  firelog-growl        A growl transport for firelog                                 =pgherveou

```

[0]: http://nodejs.org/docs/v0.3.5/api/streams.html#writable_Stream
[1]: https://github.com/taoyuan/winstond
[2]: https://github.com/taoyuan/firelog-couchdb
[3]: http://guide.couchdb.org/draft/design.html
[4]: https://github.com/mranney/node_redis
[5]: https://github.com/taoyuan/firelog-loggly
[6]: http://nodejitsu.com
[7]: https://github.com/nodejitsu/node-loggly
[8]: http://loggly.com
[9]: http://www.loggly.com/product/
[10]: http://wiki.loggly.com/loggingfromcode
[11]: https://github.com/taoyuan/firelog-riak
[12]: http://riakjs.org
[13]: https://github.com/frank06/riak-js/blob/master/src/http_client.coffee#L10
[14]: http://github.com/taoyuan/firelog-mongodb
[15]: http://github.com/appsattic/firelog-simpledb
[16]: http://github.com/wavded/firelog-mail
[17]: https://github.com/weaver/node-mail
[18]: https://github.com/jesseditson/firelog-sns
[19]: https://github.com/flite/firelog-graylog2
[20]: https://github.com/jorgebay/firelog-cassandra
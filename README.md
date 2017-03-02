<img align="right" width="250px" src="http://cdn.innovativelanguage.com/wordlists/media/thumb/8298_fit512.jpg" />


# Zindex

[![Build Status](https://magnum.travis-ci.com/namshi/zindex.svg?token=MxqAgNuVLsuCrtxWfKzR&branch=master)](https://magnum.travis-ci.com/namshi/zindex)

Namshi's indexer: a central place to work with
storage engines and sync data here and there.

Zindex is a very simple library that, at its core,
simply fetches some data from a **source** and
indexes it in **backends**.

## Installation

Clone this repository and install the required
dependencies:

```
npm install zindex --save
```
>> zindex cannot be globally installed at this time

## Zindex 101:

Zindex can be called directly as a runnable command with:
```bash
~/projects/myIndexer$ ./node_modules/zindex/bin/zindex.js
```

or as a normal library by
```javascript
var zindex = require('zindex');
```

> PROTIP
>
> You can create your very own command by putting this in your own javascript file:
>
> ```javascript
> // example run.js
> #!/usr/bin/env node
>
> var zindex = require('zindex');
> ```
>
> and than `chmod a+x run.js`

### Configuring

Zindex by default will look for scripts inside an `indexers` and a `watchers` directory in your project.

However, you can configure these paths as you wish, since we're including [`nm-config`](https://github.com/namshi/node-nmconfig).
The Available options are:

```yaml
dirs:
  base: './src'
```
Will tell `zindex` to look for both `indexers` and `watchers` under your project's `src/` directory

```yaml
dirs:
  indexers: './foo/index'
  watchers: './bar/watch'
```
Will cause `zindex` to search for  `indexers` inside the `foo/index` directory and for `watchers` inside `bar/watch`

> PROTIP
>
> If you wish to have these configs in your `package.json`
> you can add a `zindex` section:
>
> ```javascript
> {
>    "name": "myDataApp",
>    "version": "0.0.1",
>    "description": "I move data!",
>    "zindex": {
>      "dirs": {
>        "base": "./src"
>      }
>    }
>  }
>


### Indexing

```
~/projects/myIndexer$ ./node_modules/zindex/bin/zindex.js index --help

  Usage: index [options]

  Options:

    -h, --help           output usage information
    -S --since [value]   index entities in the specified timeframe (ie. "3h")
    -M --mode [value]    partial or full
    -E --entity [value]  which entity to index
```

Zindex' primary role is to be able to sync data
between one data source to N backends.

### Bootstrapping

With *bootstrapping* we indicate the act of building a backend from scratch.
This command works only on backends that expose a "bootstrap" function.
If the backend does not have a "bootstrap" function, nothing is done.
```
~/projects/myIndexer$ ./node_modules/zindex/bin/zindex.js bootstrap --help

  Usage: bootstrap [options]

  Bootstrap one or more backends

  Options:

    -h, --help            output usage information
    -E --entity [value]   which entity to index, you can specify a comma-separated list of entities
```

#### Sourcing

With *Sourcing* we indicate the base indexing action:
fetching data from a *Source*, ie: a mysql table

Zindex will look by default for indexers in your local `indexers` folder.

In order to do so, you simply need to create a
directory in your `indexers` folder with the
entity you want to sync, ie. `products`:


Zindex will read a `source.js` file that is inside that directory
to *source* the data that needs to be synced; an example
`source.js` would look like:

``` javascript
# lib/indexer/products/source.js

var shops = include('storages/mysql');
var path  = require('path');

module.exports = function(options) {
  var products = mysql.query('serverId', 'SELECT * FROM db.products');
  return {
    data: products,
    options: {myProperty: 'value'}
  };
};
```
**the returned value will be further explained below in the [`Data format`](#dataFormat) section**

> PROTIP
>
> Use the included mysql helper (`storages/mysql`),
> it will manage connections, etc. for you.
> `serverId` will be the key to configure connections
> in the config files.
>
> ```yml
> myDatabaseName:
>    database: 'zindex_{{ env }}'
>    host: 'db_1'
>    user: 'user'
>    password: 'password'
>    connectTimeout: 10000
>    acquireTimeout: 10000
>```
>
> As for the above config your `serverId` will be `myDatabaseName`

#### Transforming

With *Transforming* we indicate the actual process of manipulating
your data objects.

At this point, once the data has been extracted from
the source, you might want to apply some transformations,
like renaming a boolean field to `TRUE` or `FALSE` and so on:
To do so, zindex will look for a `transformer.js` script inside
`indexer/ENTITY/`.

An example `transformer.js` would look like:

```javascript
# indexer/products/transformer.js


function transform(product, options) {
  product['in_stock'] = !!(product.quantity > 0);
  return product;
}

module.exports = function(products, options) {
  return products.map(function(product) {
    return transform(product, options);
  });
};
```

> PROTIP
>
> As you can see, we define a `transform()` function out of the exported lamba:
> this is to allow better optimization from V8
> since in this place we're likely touching lots of objects and deopt
> code might badly impact both memory usage and performance.

To ease your life, zindex will transform the data
it gets from the source to a "[Highland](http://highlandjs.org/) Stream"
object.

Having a Highland Stream means you can do stuff
like this:


``` javascript
return products.filter(function(product){
  return product.price > 100;
}).take(10);
```

As you can see, an observable is a simple collection
which you can chunk, filter, etc.

In the example above we are simply filtering
our collection to pick the first ten products
which have a price higher than 100.

#### Persisting

*Persisting* is the last and final step of our indexing process:
Here we save the data were it needs to be saved!

The data is then fed to what we call "backends":
Zindex looks for the scripts under
`indexer/ENTITY/backends` and will send the
data to each one so they can be be stored in each
backend; think of your backends as different storage systems:
for example you might want to sync products in a mysql table,
and in redis, which means you will create two backends, one called
`products_table.js`, and the other one called `redis.js`.

If we create a file called `redis.js` under
`indexer/products/backends` and write something like:

``` javascript
# indexer/products/backends/redis.js

var redis = require('redis')('...', '...', '...');

module.exports = function(data) {
  data.each(funciton(product) {
    redis.execute('HSET', 'namshi:products', product);
  });
};
```

We will effectively have set up a sync of the products
from a MySQL table to a redis hash.

> PROTIP
>
> As you'll more likely deal with quite a bit of data, you might want to collect
> a number of them before actually saving them inside your backend facility.
> To achieve this you can leverage on Highland Stream's batches (`batch()`):

> ```javascript
> data.batch(20000).each(function(products) {
>    redis.execute('HSET', 'namshi:products', products);
>  });
> ```


## Zindex Advanced:

### Under the hood

Here are a few things you might want to know
to better understand how zindex internally works.

#### Data format <a name="dataFormat"></a>

A source should return a `result` object with a
`data` property, containing the actual data, and
an (optional ;P) options property containing all those
other useful bits of information you'd like to carry on
in your indexing process. Data will be transformed into the Highland Stream,
and options will be added to the usual options fed into every each step.

For example, the Bob source could return something
like:

``` javascript
var result = {
  data: [{id: 'row_1'}, {id: 'row_2'}, ...],
  options: {shop: 'ae'}
}
```

For backends that have multiple data sources, they
can simply return arrays of the above structure; for
example, a more extensive implementation of the Bob source
would return something like:

``` javascript
var results = [{
  data: [{id: 'row_1'}, {id: 'row_2'}, ...],
  options: { shop: 'ae'}
},{
  data: [{id: 'row_1'}, {id: 'row_2'}, ...],
  options: {shop: 'sa'}
},{
  data: [{id: 'row_1'}, {id: 'row_2'}, ...],
  options: {shop: 'me'}
}]
```
> PROTIP
>
> Your source, as data, can return a stream!
> And everything can be wrapped into a promise (or more).
> Actually, Zindex internally uses promises and streams
> as we'll see [later on](#asyncLoading)

Even though sources might return either an **array** of objects
or a **stream**, transformers and backends will always receive the data
as a first argument in the form of a `Highland Stream object`,
and all other information as `options`:

``` javascript
var backend = function(data, options) {
  console.log('Got shop?', options.shop);

  data.filter(function(product){
    return product.gender === 'male';
  }).map(function(product){
    return product.sku;
  }).toArray(function(sku){
    redis.save('male_skus', skus);
  });
};
```

#### Async loading: behind the scenes <a name="asyncLoading"></a>

As you probably noticed we always and up having a `Highland Stream` in our hands,
and this happens asyncronusly even if we're returning an object.
Under the hood Zindex uses streams and promises to avoid blocking the main thread,
and since it likes them so much it will always try to mangle what you give to it
in one of 2 things (or a combination of them).

> In depth for maniacs; Anatomy of processing a source:
>
> Since your data can come either from a single simple table, or from many different places,
> what Zindex would really like to have are either promises or streams, or lists of them as
> data property for the returned object.

Depending on your data, what Zindex provides might not be enough to save you from the deadly threat of
[blocking](https://github.com/namshi/coding-standards/blob/master/javascript.md#golden-rule-never-block).
Let's say your final data needs to be enriched by another source (the ERP for example).
In that case we strongly suggest you to leverage promises(through
[bluebird](https://www.npmjs.org/package/bluebird)) that can be conveniently fed back into a Highland Stream and everything goes back to normal :)

#### Options

Indexing can take some options like `--since 3h`
and be used within sources / backends to optimize
queries: for example, you could use an option like
`since` to optimize sourcing of your data, to speed
up sync times.


#### Templating
To ease your life you might consider using templates for your queries.
For your templating needs a [template compiler](#templateCompiler) is included

### Realtime indexing

In order to do realtime indexing (a record gets changed and it gets
immediately indexed) we simply rely on RabbitMQ and
process messages that come through:

```
~/projects/myIndexer$ ./node_modules/zindex/bin/zindex.js index-realtime --entity products --priority 0

info: Waiting to receive updates for products
info: Connected to the AMQP server...
info: Received a message to index the products with id "2567"
Starting to index...
info: Loading data for entity "products"
info: Loaded template:
SELECT *
FROM myDb.products

  WHERE product_id = 2567

LIMIT 10
info: Found 1 backends
info: Indexing products in backend "sample"
indexing: [ { product_id: 2567, name: 'shoes' } ]
```

Daemons will need an entity and a priority, so that
they will be able to receive specific updates:
the queues will take the name  `indexer.ENTITY.PRIORITY`, for
example `indexer.products.1`.

What the daemon does is simply call the indexer, pass it
the entity and the ID of the update. Then the indexer runs with
the given options; for example, you can customize your
queries using something like:

``` sql
SELECT *
FROM myDb.products
{% if id %}
  WHERE product_id = {{ id }}
{% endif %}
```

### Watchers

#### The basics

```
~/projects/myIndexer$ ./node_modules/zindex/bin/zindex.js watch --help

  Usage: watch [options]

  Options:

    -h, --help                       output usage information
    -E --entity <entity,entity,...>  One or more entities to watch, comma separated
    -I --interval [value]            interval between checks (ie. "3m")
```

Watchers are what keeps an eye on data changes and
broadcasts messages based on the obtained data: as we saw,
realtime indexing will consume messages that come through
RabbitMQ and the watchers are the ones responsible for keeping
an eye on the DB and, as soon as a record gets updated,
send a message to RabbitMQ.

A watcher provides the `watch()` method including the
actual logic to watch a `source`. A `notify` function
will be provided to the `watch()` logic in order to broadcast messages.

You can specify an `entity` name for the watcher if the
"watcher file" (ie. items.js) has a different name from your entity ("items").

Long story short: when the watcher finds that a record gets updated
it calls `notify(entity, id [, priority])` which will send a message to RabbitMQ

watcher example:

```javascript
module.exports = {
  entity: 'products',
  watch: function (options, notify) {
    setInterval(function(){
      products = db.query('SELECT * FROM products WHERE updated_at < 5000');

      results.foreach(function(product){
        // notify(key, value, [priority])

        notify('product', product.id, 0);
      });

    }, 5000);
};
```


Depending on the source of your data it might need to poll,
in that case you can use javascript's `setInterval()` but bear in mind, accuracy is
not guaranteed, so you might need to detect and adjust the time-shift error.
We do provide some [support objects](#wSources) capable of dealing with this as we'll see later.

Once you create a new watcher simply include
it in the `watchers/` directory and
it will be usable via the `-E` option on the command line.

```bash
~/projects/myIndexer$ ./node_modules/zindex/bin/zindex.js watch -E your_new_watcher_name
```

All the watchers will run automatically if no `-E` is provided.

> PROTIP
>
> Running multiple watchers at once isn't a great idea and it
> is allowed mainly for debugging purposes. If one watcher goes down
> all the others go down too -- so, yeah, be careful :)

#### Watchers' Sources: keeping an eye on multiple things

The root of a watcher is a [`Source` object](#watchersBaseSource)

Here is an example of a watcher using a custom source extending the [base one](#watchersBaseSource):

```javascript
module.exports = {
  init: function(templates, options) {
    this.entity = options.name || null;
    this.templates = templates || null;
    this.globOptions = options.globOptions || null;
  },
  watch: function (options, notify) {
    var self = this;
    notifier.options.priority = 0;

    var source = new mySource(options, self.templates, self.globOptions);

    function getNewData() {
      source.get().then(function(results) {
        _.forEach(results, function(value, key) {
          notifier.notify(key, value);
        });
      });
    }

    setInterval(function() {
      logger.debug('Poller:: run (' + self.entity + ')');
      getNewData();
    }, source.interval);
  }
}
```

For your convenience we build a [mysql abstract source](#watchersAbstractMysql) that will ease your life :)

## Zindex toolkit: <a name="toolKit"></a>

Zindex exports a special `include()` function giving access to a series
of provided goodies to ease your indexing needs:

### Config <a name="ampqHelper"></a>

`var config = include('config');`
this will return a [`reconfig`](https://github.com/namshi/reconfig) object
generated by the underlying [`nm-config`](https://github.com/namshi/node-nmconfig)


### Mysql Helper <a name="mysqlHelper"></a>

`var mysql = include('storages/mysql');`

This is a helper built on top of node's mysql library, its aim is to conceal
most of the ceremony you would need to do, to connect and query a mysql database in
a single convenient method:

``` javascript
mysql.query(targetPool, sql, options);
```
The possible params are the following:

*targetPool*: the name of the database server we want to connect to as listed inside the config file
*sql*: your sql or sql template
*options*: formatted data in case of a sql template.

It will also take care of making your communication towards the database simpler
and more efficient, spawning N connections (as set in the config file), queueing
your queries, and taking everything up or down upon need.

> PROTIP
>
> Use bulk queries and templates to insert lots of data in a single shot.

### AMPQ Helper <a name="ampqHelper"></a>

`var amqp = include('storages/amqp');`

As by its name, this library will help you connect to an amqp queue (rabbit, for instance)
To listen on a queue and get a message you simply need to do:

```javascript
amqp.listen(options).then(function() {
  amqp.queue.each(function(message) {
    console.log(message);
  });
});
```

Zindex will figure out the correct queue for you based on the command's option
received in the console.

If you need to send a message you can use the [notifier](#notifier) library built
on top of this helper.

### Notifier <a name="notifier"></a>

`var notifier = include('notifier');`

It's the one automatically injected in all the watchers, and it provides a handy way to push messages
on the rabbit queues without all the ceremony.

to queue a message simply do:

```javascript
notifier(options).notify(key, message, priority);
```

The options can have 2 keys:
* entity: as the entty sending the message
* priority: the queue's default priority

The `notify()` method's `message` parameter can be whatever value transformable
in a valid json, and it mostly depends on what the receving indexer is expecting to have.
The `priority` param for the notification will effect only the current message.


### Utils <a name="utils"></a>

`var utils = include('utils');`

[This](https://github.com/namshi/zindex/blob/master/lib/utils.js) little lib wraps and increments node's util module
with some commodity functions.

You might want to take a look at:

* stringToMoment(): dealing with date and times between humans and computers can be
quite annoying so we chose to use [momentjs](http://momentjs.com/) to provide an easy way
to specify times and intervals, and a convenient way for us to use it.

* prepareForBulkQuery(): you'll find this little function especially useful in your
mysql backends. Give it a list of objects and it will transform them in an handy object easy
to use with a sql template query to feed to our [helper](#mysqlHelper)

* wrapInPromise(): wrap your data structure in a promise for you to carry around
conveniently in async contexts.

### Logger <a name="logger"></a>

`var logger = include('logger');`

Our logger exposes a classic [winston](https://github.com/flatiron/winston) logging interface
with some added config values as well as a graylog transport handy in the production environment.

### Graylog

By default Zindex will log in console.

Access [the web interface](http://localhost:9000/) with the
`admin:zindex` account and configure a UDP endpoint.

Enjoy graylogging!

### Template Compiler <a name="templateCompiler"></a>

`var tpl = include('tpl');`

The `tpl` module provides a way to parse template
files and transform them into queries:

``` sql
SELECT *
FROM myDb.products
{% if since %}
  WHERE UPDATED_AT > "{{ since.format('YYYY-DD-MM HH:mm:s') }}"
{% endif %}
LIMIT 10
```

It will also cache the compiled query for you so your logic will not need to access the filesystem
every time :)

## Tests

Tests are run through mocha, you can simply run
`npm test`.

The build is continuously run on
[travis](https://magnum.travis-ci.com/namshi/zindex) as well.

var amqp = require('./storages/amqp');
var logger = require('./logger');
var utils = require('./utils');

var Notifier = function(options) {
  this.options = options;
  this.exchange = null;
  this.connect();
};

/**
 * Figures out the queue where to write,
 * if a key is provided it will narrow the queue down
 * otherwise will return a more general one
 *
 * @param {String} key
 * @returns {string}
 */
Notifier.prototype.getQueue = function(key) {
  return 'indexer.' + key.replace('exported_', '') + '.' + this.options.priority;
};

/**
 * Sends a message on the appropriate queue
 *
 * @param {String} key
 * @param {String} message
 * @param {Number} [priority]
 */
Notifier.prototype.notify = function(key, message, priority) {
  var self = this;
  this.options.priority = priority || this.options.priority;

  this.connect().then(function() {
    utils.checkRequires(self, ['options', 'exchange']);
    self.exchange.publish(self.getQueue(key), message, {
      deliveryMode: 2
    });
  });
};

/**
 * Connect to the transport layer
 *
 * @returns {Promise}
 */
Notifier.prototype.connect = function() {
  var self = this;

  return new Promise(function(resolve) {
    if (self.exchange === null) {
      return amqp.connect().then(function() {
        self.exchange = amqp.exchange;
        resolve();
      }).catch(function(error) {
        logger.error('Notifier for "' + self.options.entity + '" watcher, connection error: ', JSON.stringify(error));
        process.exit(1);
      });
    } else {
      resolve();
    }
  });
};

/**
 * Sets up and returns a new notifier instance based in options
 *
 * @param options
 * @returns {Notifier}
 */
module.exports = function(options) {
  return new Notifier(options);
};

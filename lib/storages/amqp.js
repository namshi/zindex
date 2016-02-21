var amqp = require('amqp');
var Promise = require('bluebird');
var config = include('config');
var logger = include('logger');
var amqpServerConfig = config.get('amqp');
var connectionRetry = config.get('amqp.retry');

module.exports = {
  connection: {},
  exchange: {},
  queue: {},

  /**
   * Creating the amqp connection
   *
   * @returns {Promise}
   */
  connect: function() {
    var self = this;

    return new Promise(function(resolve, reject) {
      self.connection = amqp.createConnection(amqpServerConfig);

      self.connection.on('ready', function() {
        connectionRetry = config.get('amqp.retry');
        self.exchange = self.connection.exchange('', {autoDelete: false});
        resolve();
      });

      self.connection.on('error', function() {
        connectionRetry--;

        if (connectionRetry > 0) {
          logger.warn('Amqp connection error retrying ' + connectionRetry + ' more times');
        } else {
          reject('Cannot connect with ' + config.get('amqp.host') + ' after ' + config.get('amqp.retry') + ' retries');
        }
      });

      self.connection.on('end', function() {
        reject('Connection with ' + config.get('amqp.host') + 'closed');
      });
    });
  },

  /**
   * Listens to AMQP messages, after setting up the
   * queue from the given options, and uses the indexer
   * to update entities sent through those messages.
   *
   * The queues have the name `indexer.ENTIITY.PRIORITY`.
   */
  listen: function(options) {
    var self = this;

    return this.connect().then(function() {
      return new Promise(function(resolve) {
        self.connection.queue('indexer.' + options.entity + '.' + options.priority, {autoDelete: false, durable: true}, function(q) {
          logger.info('Connected to the AMQP server ' + config.get('amqp.host') + ' on queue ' + q.name + '...');

          self.queue = q;
          resolve();
        });
      });
    });
  }
};

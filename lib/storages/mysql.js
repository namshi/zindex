var Promise = require('bluebird');
var config = include('config');
var mysqlLib = require('mysql2');
var serversConfig = config.get('mysql');
var logger = include('logger');
var _ = require('lodash');
var dbPools = {};
var vpo = require('vpo');

/**
 * CReates or return a pool for the given DB
 *
 * @param  {String} targetDb
 * @return {Object}
 */
function getPool(targetDb) {
  logger.debug('MysqlStorage:: get pool for ' + targetDb);
  var connectionParams = _.clone(serversConfig.dbs[targetDb]);
  delete connectionParams.database;

  if (!dbPools[targetDb] || dbPools[targetDb]['_closed']) {
    delete dbPools[targetDb];
    logger.info('MysqlStorage:: creating new pool for ' + targetDb);
    dbPools[targetDb] = mysqlLib.createPool(connectionParams);
    dbPools[targetDb].users = 0;
  }

  return dbPools[targetDb];
}

/**
 * Gets a connection to the target DB
 * from the appropriate pool
 *
 * @param  {String} targetDb [description]
 * @return {Promise}
 */
function getConnection(targetDb) {
  logger.debug('MysqlStorage:: get connection: ' + targetDb);
  return new Promise(function(resolve) {
    var pool = getPool(targetDb);
    pool.getConnection(function(error, connection) {
      if (error) {
        logger.warn('MysqlStorage:: Problems while getting connection to ' + targetDb + ', retrying... error: ', JSON.stringify({
          mssage: error.message,
          stack: error.stack,
          poolClosed: ((pool[targetDb]) ? pool[targetDb]['_closed'] : null),
          error: error
        }));
        getConnection(targetDb).then(resolve);
        return;
      }

      pool.users++;
      pool.lastUsedAt = (new Date()).getTime();
      resolve(connection);
    });
  });
}

/**
 * Eventually closes the connection pool
 * to the target DB
 *
 * @param  {String} targetDb
 */
function closePool(targetDb) {
  if (dbPools[targetDb]) {
    dbPools[targetDb].users--;

    setTimeout(function() {
      var now = (new Date()).getTime();
      if (dbPools[targetDb] && dbPools[targetDb].users <= 0 && (now - dbPools[targetDb].lastUsedAt) >= config.get('mysql.settings.reuseLimit')) {
        dbPools[targetDb].end(function() {
          logger.info('MysqlStorage:: closing pool for ' + targetDb);
          dbPools[targetDb] = undefined;
        });
      }

    }, config.get('mysql.settings.reuseLimit'));
  }
}

/**
 * Where the actually work happens
 *
 * it gets a correct connection from the pool cluster
 * based on the `targetPool`
 *
 * @param {String} targetPool
 * @param {String} sql
 * @param {Object | Array} [options]
 * @returns {Promise}
 */
function query(targetDb, sql, options) {
  options = options || {};

  return getConnection(targetDb).then(function(connection) {
    var stream = connection.query(sql, options).stream({
      highWaterMark: 1000
    });

    stream.on('error', function(error) {
      error.sql = sql;
      logger.error('MysqlStorage:: error on query stream for connection to ' + targetDb + ': ' + JSON.stringify(error));
      connection.release();
      closePool(targetDb);
      throw new Error(JSON.stringify(error));
    });

    stream.on('close', function() {
      connection.release();
      closePool(targetDb);
    });

    return stream;
  });
}

/**
 * Exporting the mysql driver.
 */
var mysql = {

  /**
   * Executes a query.
   *
   * @param targetDb
   * @param sql
   * @param options
   * @returns {Promise}
   */
  query: query,
  format: mysqlLib.format
};

module.exports = mysql;

global.include = function(path) {
  return require(require('path').join(__dirname, '..', 'lib', path));
};

var logger = require('../lib/logger');
var _ = require('lodash');
var config = require('../lib/config');
var fs = require('fs');
var path = require('path');
var zindex = require('../lib/zindex');

var history = [];
var running = [];



module.exports = function (app, indexersPath) {
  var indexers = fs.readdirSync(indexersPath);
  
  function runAll(userEmail, res) {
    var timer = {};
    var task = {
      id: new Date().getTime(),
      user: userEmail,
      requested: new Date(),
      start: new Date()
    };

    running.push(task);

    /**
     * if for some reason the index get stucked this timer will reset the status.
     * in order to be able to run a new index again.
     * It it definded as 20 min because it is 3 times what the run usually needs
     *
     * If everything it is fine the timer is cancelled with a clearInterval()
     */
    timer = setTimeout(() => {
      if (running.length > 0) {
        logger.error(`Stopping automatically the task! Since is working since 20 mins`);
        updateHistory(task, false);
      }
    }, 1200000); // 20 mins

    var promises = [];

    indexers.forEach((indexName) => {
      promises.push(runIndexer(indexName, res));
    });

    return Promise.all(promises).then((result) => {
      updateHistory(task, true);
      clearTimeout(timer);
    }).catch((err) => {
      updateHistory(task, false);

      clearTimeout(timer);
    });
  }

  function updateHistory(task, result) {
    task.end = new Date();
    task.duration = (task.end - task.start) / 1000 + ' seconds';
    task.result = result;

    running = _.filter(running, function(t){
      return t.id != task.id;
    });

    history.unshift(task);
  }

  function runIndexer(indexer, res) {
    process.stdout.write = process.stderr.write = res.write.bind(res);
    
    return zindex({entity: indexer}).then((res) => {
      logger.info('DONE...' + indexer)
    }).catch((err) => {
      logger.error(err);

      throw err;
    });
  }

  app.get('/', (req, res) => {
    var fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    res
      .status(200)
      .json({
        schedule: fullUrl + 'schedule',
        command: fullUrl + 'run'
      });
  });

  app.get('/run', (req, res) => {
    if(running.length > 0) {
      return res.status(400).json({'message': `indexer already running` });
    }
    runAll(req.user.email, res);
  });

  app.get('/schedule', (req, res) => {
    res.json({
      running: running,
      history: history
    });
  });
};

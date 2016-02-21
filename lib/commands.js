/**
 * Required modules.
 */
var fs = require('fs');
var _ = require('lodash');
var path = require('path');
var commandDirectory = path.join(__dirname, 'command');

/**
 * Register a command, by filename, on the app.
 *
 * If the command file is called some.js, this
 * will register as 'some' so that you can call
 * it via 'node index.js some [options]'.
 *
 * If a command exports a configure() function
 * it will be called so that they can register
 * custom options or arguments.
 */
var registerCommand = function(filename, app) {
  var name = path.basename(filename, path.extname(filename));
  var commandDefinition = require(path.join(commandDirectory, name));
  var command = app.command(name);

  command.description(commandDefinition.description || 'Executes the "' + name + '" command');
  command.action(commandDefinition.action || null);

  if (commandDefinition.configure) {
    commandDefinition.configure(command);
  }
};

module.exports = {
  /**
   * Register all available commands in the app.
   */
  register: function(app) {
    var commands = fs.readdirSync(commandDirectory);

    _.each(commands, function(command) {
      registerCommand(command, app);
    });
  }
};

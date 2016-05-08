module.exports = require('node-nmconfig')({
  ensure: 'dev.yml',
  projectName: process.env.PROJECT_NAME || 'zindex'
});

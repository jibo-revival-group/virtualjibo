require('../lib/node_loader');
var Jibo = require('../lib/core');

module.exports = {
  Log: require('./log'),
  Account: require('./account'),
  Backup: require('./backup'),
  Notification: require('./notification'),
  Robot: require('./robot'),
  Loop: require('./loop'),
  Media: require('./media'),
  Person: require('./person'),
  GQA: require('./gqa')
};
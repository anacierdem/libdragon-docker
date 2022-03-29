const { fn: exec } = require('./exec');

const make = async (libdragonInfo, params) => {
  await exec(libdragonInfo, ['make', ...params]);
};

// TODO: separate into files
module.exports = {
  start: require('./start'),
  stop: require('./stop'),
  init: require('./init'),

  exec: require('./exec'),
  make: {
    name: 'make',
    fn: make,
    forwardsRestParams: true,
    showStatus: true,
  },

  install: require('./install'),
  update: require('./update'),

  help: require('./help'),
};

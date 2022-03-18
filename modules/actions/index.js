const { spawnProcess } = require('../helpers');
const { checkContainerRunning } = require('./utils');

const { fn: exec } = require('./exec');

const stop = async (libdragonInfo) => {
  const running =
    libdragonInfo.containerId &&
    (await checkContainerRunning(libdragonInfo.containerId));
  if (!running) {
    return;
  }

  await spawnProcess('docker', ['container', 'stop', running]);
};

const make = async (libdragonInfo, params) => {
  await exec(libdragonInfo, ['make', ...params]);
};

// TODO: separate into files
module.exports = {
  start: require('./start'),
  stop: {
    name: 'stop',
    fn: stop,
    showStatus: false, // This will only print out the id
  },
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

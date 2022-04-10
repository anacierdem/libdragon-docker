const { spawnProcess } = require('../helpers');

const { checkContainerRunning } = require('./utils');

const stop = async (libdragonInfo) => {
  const running =
    libdragonInfo.containerId &&
    (await checkContainerRunning(libdragonInfo.containerId));
  if (!running) {
    return;
  }

  await spawnProcess('docker', ['container', 'stop', running]);
  return libdragonInfo;
};

module.exports = {
  name: 'stop',
  fn: stop,
  usage: {
    name: 'stop',
    summary: 'Stop the container for current project.',
    description: `Stop the container assigned to the current libdragon project.

      Must be run in an initialized libdragon project.`,
  },
};

const { spawnProcess } = require('../helpers');

const { checkContainerRunning, mustHaveProject } = require('./utils');

const stop = async (libdragonInfo) => {
  await mustHaveProject(libdragonInfo);
  const running =
    libdragonInfo.containerId &&
    (await checkContainerRunning(libdragonInfo.containerId));
  if (!running) {
    return;
  }

  await spawnProcess('docker', ['container', 'stop', running]);
};

module.exports = {
  name: 'stop',
  fn: stop,
  showStatus: false, // This will only print out the id
  usage: {
    name: 'stop',
    summary: 'Stop the container for current project.',
    description: `Stop the container assigned to the current libdragon project.

      Must be run in an initialized libdragon project.`,
  },
};

const { spawnProcess, ValidationError } = require('../helpers');

const { checkContainerRunning } = require('../utils');

/**
 * @param {import('../project-info').LibdragonInfo} libdragonInfo
 * @returns {Promise<import('../project-info').LibdragonInfo | void>}
 */
const stop = async (libdragonInfo) => {
  if (process.env.DOCKER_CONTAINER) {
    throw new ValidationError(
      `Not possible to stop the container from inside.`
    );
  }

  const running =
    libdragonInfo.containerId &&
    (await checkContainerRunning(libdragonInfo.containerId));
  if (!running) {
    return;
  }

  await spawnProcess('docker', ['container', 'stop', running]);
  return libdragonInfo;
};

module.exports = /** @type {const} */ ({
  name: 'stop',
  fn: stop,
  forwardsRestParams: false,
  usage: {
    name: 'stop',
    summary: 'Stop the container for current project.',
    description: `Stop the container assigned to the current libdragon project.

      Must be run in an initialized libdragon project.`,
  },
});

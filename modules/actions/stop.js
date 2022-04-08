const { dockerCompose } = require('../helpers');
const { DOCKER_SERVICE_NAME } = require('../constants');

const stop = async (libdragonInfo) => {
  await dockerCompose(libdragonInfo, ['stop', DOCKER_SERVICE_NAME]);
  return libdragonInfo;
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

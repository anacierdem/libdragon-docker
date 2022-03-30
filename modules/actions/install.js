const chalk = require('chalk');

const { installDependencies, mustHaveProject } = require('./utils');
const { fn: start } = require('./start');
const { updateAndStart } = require('./update-and-start');
const { log } = require('../helpers');

/**
 * Updates the image if flag is provided and install vendors onto the container.
 * We should probably remove the image installation responsibility from this
 * action but it might be a breaking change.
 * @param libdragonInfo
 * @param skipUpdate This is added to skip the update when calling this from
 * the update action as it already does an update itself. install doing an image
 * update is pretty much a useless operation, but let's keep it in case someone
 * depends on it. It used to only update the image if the flag is provided and
 * we still keep that logic but with a deprecation warning.
 */
const install = async (libdragonInfo, skipUpdate) => {
  await mustHaveProject(libdragonInfo);
  let updatedInfo = libdragonInfo;
  const imageName = libdragonInfo.options.DOCKER_IMAGE;
  // If an image is provided, attempt to install
  if (imageName && skipUpdate !== true) {
    log(
      chalk.yellow(
        'Using `install` action to update the docker image is deprecated. Use the `update` action instead.'
      )
    );
    updatedInfo = await updateAndStart(libdragonInfo);
  } else {
    // Make sure existing one is running
    updatedInfo = {
      ...updatedInfo,
      containerId: await start(libdragonInfo),
    };
  }

  // Re-install vendors on new image
  // TODO: skip this if unnecessary
  await installDependencies(updatedInfo);
};

module.exports = {
  name: 'install',
  fn: install,
  showStatus: true,
};

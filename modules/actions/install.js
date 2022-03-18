const { log } = require('../helpers');
const {
  destroyContainer,
  installDependencies,
  updateImage,
} = require('./utils');
const { fn: start } = require('./start');

/**
 * Updates the image if flag is provided and install vendors onto the container.
 * We should probably remove the image installation responsibility from this
 * action but it might be a breaking change. Maybe we can keep it backward
 * compatible with additional flags.
 * @param libdragonInfo
 */
const install = async (libdragonInfo) => {
  let containerId;
  const oldImageName = libdragonInfo.imageName;
  const imageName = libdragonInfo.options.DOCKER_IMAGE;
  // If an image is provided, always attempt to install it
  // See https://github.com/anacierdem/libdragon-docker/issues/47
  if (imageName) {
    log(`Changing image from \`${oldImageName}\` to \`${imageName}\``);

    // Download the new image and if it is different, re-create the container
    if (await updateImage(libdragonInfo, imageName)) {
      await destroyContainer(libdragonInfo);
    }

    containerId = await start({
      ...libdragonInfo,
      imageName,
    });
  } else {
    // Make sure existing one is running
    containerId = await start(libdragonInfo);
  }

  // Re-install vendors on new image
  // TODO: skip this if unnecessary
  await installDependencies({
    ...libdragonInfo,
    imageName,
    containerId,
  });
};

module.exports = {
  name: 'install',
  fn: install,
  showStatus: true,
};

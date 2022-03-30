const { log } = require('../helpers');
const { updateImage, destroyContainer } = require('./utils');
const { fn: start } = require('./start');

async function updateAndStart(libdragonInfo) {
  const oldImageName = libdragonInfo.imageName;
  const imageName = libdragonInfo.options.DOCKER_IMAGE ?? oldImageName;
  // If an image is provided, always attempt to install it
  // See https://github.com/anacierdem/libdragon-docker/issues/47
  log(`Updating image from \`${oldImageName}\` to \`${imageName}\``);

  // Download the new image and if it is different, re-create the container
  if (await updateImage(libdragonInfo, imageName)) {
    await destroyContainer(libdragonInfo);
  }

  return {
    ...libdragonInfo,
    imageName,
    containerId: await start({
      ...libdragonInfo,
      imageName,
    }),
  };
}

module.exports = {
  updateAndStart,
};

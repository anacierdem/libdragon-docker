const { log, dockerCompose } = require('../helpers');

async function updateAndStart(libdragonInfo) {
  const oldImageName = libdragonInfo.imageName;
  const imageName = libdragonInfo.options.DOCKER_IMAGE ?? oldImageName;
  // If an image is provided, always attempt to install it
  // See https://github.com/anacierdem/libdragon-docker/issues/47
  if (oldImageName !== imageName) {
    log(`Updating image from \`${oldImageName}\` to \`${imageName}\``);
  } else {
    log(`Updating image \`${oldImageName}\``);
  }

  await dockerCompose(libdragonInfo, ['pull']);
  await dockerCompose(libdragonInfo, ['up', '-d']);

  return {
    ...libdragonInfo,
    imageName,
  };
}

module.exports = {
  updateAndStart,
};

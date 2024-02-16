const { log, assert } = require('../helpers');
const { LIBDRAGON_GIT, LIBDRAGON_BRANCH } = require('../constants');
const {
  runGitMaybeHost,
  installDependencies,
  updateImage,
  destroyContainer,
} = require('../utils');
const { start } = require('./start');

/**
 * @param {import('../project-info').LibdragonInfo} libdragonInfo
 */
async function syncImageAndStart(libdragonInfo) {
  assert(
    !process.env.DOCKER_CONTAINER,
    new Error(
      '[syncImageAndStart] We should already know we are in a container.'
    )
  );

  const oldImageName = libdragonInfo.imageName;
  const imageName = libdragonInfo.options.DOCKER_IMAGE ?? oldImageName;
  // If an image is provided, always attempt to install it
  // See https://github.com/anacierdem/libdragon-docker/issues/47
  if (oldImageName !== imageName) {
    log(`Updating image from \`${oldImageName}\` to \`${imageName}\``);
  } else {
    log(`Updating image \`${oldImageName}\``);
  }

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

/**
 * @param {import('../project-info').LibdragonInfo} info
 */
const update = async (info) => {
  info = await syncImageAndStart(info);

  if (info.vendorStrategy !== 'manual') {
    log(`Updating ${info.vendorStrategy}...`);
  }

  if (info.vendorStrategy === 'submodule') {
    await runGitMaybeHost(info, [
      'submodule',
      'update',
      '--remote',
      '--merge',
      info.vendorDirectory,
    ]);
  } else if (info.vendorStrategy === 'subtree') {
    await runGitMaybeHost(info, [
      'subtree',
      'pull',
      '--prefix',
      info.vendorDirectory,
      LIBDRAGON_GIT,
      LIBDRAGON_BRANCH,
      '--squash',
    ]);
  }

  await installDependencies(info);
};

module.exports = /** @type {const} */ ({
  name: 'update',
  fn: update,
  forwardsRestParams: false,
  usage: {
    name: 'update',
    summary: 'Update libdragon and do an install.',
    description: `Will update the docker image and if you are using auto-vendoring (see \`--strategy\`), will also update the submodule/subtree from the remote branch (\`trunk\`) with a merge/squash strategy and then perform a \`libdragon install\`. You can use the \`install\` action to only update all libdragon related artifacts in the container.

      Must be run in an initialized libdragon project.`,
    group: ['docker'],
  },
});

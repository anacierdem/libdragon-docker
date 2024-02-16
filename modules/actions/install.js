const { installDependencies } = require('../utils');
const { start } = require('./start');

/**
 * Updates the image if flag is provided and install vendors onto the container.
 * We should probably remove the image installation responsibility from this
 * action but it might be a breaking change.
 * @param {import('../project-info').LibdragonInfo} libdragonInfo
 */
const install = async (libdragonInfo) => {
  let updatedInfo = libdragonInfo;

  if (!process.env.DOCKER_CONTAINER) {
    // Make sure existing one is running
    updatedInfo = {
      ...updatedInfo,
      containerId: await start(libdragonInfo),
    };
  }

  // Re-install vendors on new image
  // TODO: skip this if unnecessary
  await installDependencies(updatedInfo);
  return updatedInfo;
};

module.exports = /** @type {const} */ ({
  name: 'install',
  fn: install,
  forwardsRestParams: false,
  usage: {
    name: 'install',
    summary: 'Vendor libdragon as is.',
    description: `Attempts to build and install everything libdragon related into the container. This includes all the tools and third parties used by libdragon except for the toolchain. If you have made changes to libdragon, you can execute this action to build everything based on your changes. Requires you to have an intact vendoring target (also see the \`--directory\` flag). If you are not working on libdragon itself, you can just use the \`update\` action instead.

    Must be run in an initialized libdragon project. This can be useful to recover from a half-baked container.`,
  },
});

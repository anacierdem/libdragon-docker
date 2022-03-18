const path = require('path');

const { log } = require('../helpers');
const { initSubmodule, runGitMaybeHost } = require('./utils');
const { fn: start } = require('./start');
const { fn: install } = require('./install');

const update = async (libdragonInfo) => {
  const containerId = await start(libdragonInfo);

  const newInfo = {
    ...libdragonInfo,
    containerId,
  };

  // Only do auto-update if there is no manual vendoring set-up
  if (libdragonInfo.vendorStrategy === 'submodule') {
    // Update submodule
    log('Updating submodule...');

    try {
      await initSubmodule(newInfo);
    } catch {
      throw new Error(
        `Unable to re-initialize vendored libdragon. Probably git does not know the vendoring target (${path.join(
          libdragonInfo.root,
          libdragonInfo.vendorDirectory
        )}) Removing it might resolve this issue.`
      );
    }

    await runGitMaybeHost(newInfo, [
      'submodule',
      'update',
      '--remote',
      '--merge',
      './' + libdragonInfo.vendorDirectory,
    ]);
  }

  await install(newInfo);
};

module.exports = {
  name: 'update',
  fn: update,
  showStatus: true,
};

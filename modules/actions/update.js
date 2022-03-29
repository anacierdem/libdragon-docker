const path = require('path');

const { log } = require('../helpers');
const { LIBDRAGON_GIT, LIBDRAGON_BRANCH } = require('../constants');
const { runGitMaybeHost, mustHaveProject } = require('./utils');
const { fn: start } = require('./start');
const { fn: install } = require('./install');

const update = async (libdragonInfo) => {
  await mustHaveProject(libdragonInfo);
  const containerId = await start(libdragonInfo);

  const newInfo = {
    ...libdragonInfo,
    containerId,
  };

  if (newInfo.vendorStrategy !== 'manual') {
    log(`Updating ${newInfo.vendorStrategy}...`);
  }

  if (newInfo.vendorStrategy === 'submodule') {
    await runGitMaybeHost(newInfo, [
      'submodule',
      'update',
      '--remote',
      '--merge',
      newInfo.vendorDirectory,
    ]);
  } else if (newInfo.vendorStrategy === 'subtree') {
    await runGitMaybeHost(newInfo, [
      'subtree',
      'pull',
      '--prefix',
      path.relative(libdragonInfo.root, libdragonInfo.vendorDirectory),
      LIBDRAGON_GIT,
      LIBDRAGON_BRANCH,
      '--squash',
    ]);
  }

  await install(newInfo);
};

module.exports = {
  name: 'update',
  fn: update,
  showStatus: true,
};

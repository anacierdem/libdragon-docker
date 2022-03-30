const path = require('path');

const { log } = require('../helpers');
const { LIBDRAGON_GIT, LIBDRAGON_BRANCH } = require('../constants');
const { runGitMaybeHost, mustHaveProject } = require('./utils');
const { fn: install } = require('./install');
const { updateAndStart } = require('./update-and-start');

const update = async (libdragonInfo) => {
  await mustHaveProject(libdragonInfo);
  const newInfo = await updateAndStart(libdragonInfo);

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

  // The second parameter forces it to skip the image update step as we already
  // do that above.
  await install(newInfo, true);
};

module.exports = {
  name: 'update',
  fn: update,
  showStatus: true,
};

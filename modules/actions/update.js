const { log } = require('../helpers');
const { LIBDRAGON_GIT, LIBDRAGON_BRANCH } = require('../constants');
const { runGitMaybeHost } = require('./utils');
const { fn: install } = require('./install');
const { updateAndStart } = require('./update-and-start');

const update = async (libdragonInfo) => {
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
      libdragonInfo.vendorDirectory,
      LIBDRAGON_GIT,
      LIBDRAGON_BRANCH,
      '--squash',
    ]);
  }

  // The second parameter forces it to skip the image update step as we already
  // do that above.
  return await install(newInfo, true);
};

module.exports = {
  name: 'update',
  fn: update,
  usage: {
    name: 'update',
    summary: 'Update libdragon and do an install.',
    description: `Will update the docker image and if you are using auto-vendoring (see \`--strategy\`), will also update the submodule/subtree from the remote branch (\`trunk\`) with a merge/squash strategy and then perform a \`libdragon install\`. You can use the \`install\` action to only update all libdragon related artifacts in the container.

      Must be run in an initialized libdragon project.`,
    group: ['docker'],
  },
};

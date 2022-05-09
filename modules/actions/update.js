const { log } = require('../helpers');
const { LIBDRAGON_GIT, LIBDRAGON_BRANCH } = require('../constants');
const { runGitMaybeHost, installDependencies } = require('./utils');
const { syncImageAndStart } = require('./update-and-start');

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

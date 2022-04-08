const path = require('path');

const { CONTAINER_TARGET_PATH } = require('../constants');

const {
  fileExists,
  log,
  spawnProcess,
  dockerExec,
  assert,
  CommandError,
  ValidationError,
  ParameterError,
  toNativePath,
  dockerCompose,
} = require('../helpers');

const { dockerHostUserParams } = require('./docker-utils');
const { installNPMDependencies } = require('./npm-utils');

const installDependencies = async (libdragonInfo) => {
  const buildScriptPath = path.join(
    libdragonInfo.root,
    toNativePath(libdragonInfo.vendorDirectory),
    'build.sh'
  );
  if (!(await fileExists(buildScriptPath))) {
    throw new ValidationError(
      `build.sh not found. Make sure you have a vendored libdragon copy at ${libdragonInfo.vendorDirectory}`
    );
  }

  libdragonInfo.showStatus && log('Installing libdragon to the container...');

  await dockerExec(
    libdragonInfo,
    [
      '--workdir',
      CONTAINER_TARGET_PATH + '/' + libdragonInfo.vendorDirectory,
      ...dockerHostUserParams(libdragonInfo),
    ],
    ['/bin/bash', './build.sh']
  );

  await installNPMDependencies(libdragonInfo);
};

/**
 * Invokes host git with provided params. If host does not have git, falls back
 * to the docker git, with the nix user set to the user running libdragon.
 */
async function runGitMaybeHost(libdragonInfo, params, interactive = 'full') {
  assert(
    libdragonInfo.vendorStrategy !== 'manual',
    new Error('Should never run git if vendoring strategy is manual.')
  );
  try {
    return await spawnProcess('git', ['-C', libdragonInfo.root, ...params], {
      // Windows git is breaking the TTY somehow - disable interactive for now
      // We are not able to display progress for the initial clone b/c of this
      interactive: /^win/.test(process.platform) ? false : interactive,
    });
  } catch (e) {
    if (!(e instanceof CommandError)) {
      return await dockerExec(
        libdragonInfo,
        // Use the host user when initializing git as we will need access
        [...dockerHostUserParams(libdragonInfo)],
        ['git', ...params],
        false,
        interactive
      );
    }
    throw e;
  }
}

async function checkContainerExists(libdragonInfo) {
  return (await dockerCompose(libdragonInfo, ['ps', '-q'])).trim();
}

// Throws if the project was not initialized for the current libdragonInfo
async function mustHaveProject(libdragonInfo) {
  if (!libdragonInfo.haveProjectConfig) {
    throw new ParameterError(
      'This is not a libdragon project. Initialize with `libdragon init` first.'
    );
  }
}

module.exports = {
  installDependencies,
  checkContainerExists,
  dockerHostUserParams,
  runGitMaybeHost,
  mustHaveProject,
};

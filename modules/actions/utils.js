const path = require('path');
const fs = require('fs/promises');

const {
  CONTAINER_TARGET_PATH,
  CACHED_CONTAINER_FILE,
} = require('../constants');

const {
  fileExists,
  log,
  spawnProcess,
  dockerExec,
  dirExists,
  assert,
  CommandError,
  ValidationError,
  toNativePath,
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

  log('Installing libdragon to the container...');

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
 * Downloads the given docker image. Returns false if the local image is the
 * same, new image name otherwise.
 * @param libdragonInfo
 * @param newImageName
 * @returns false | string
 */
const updateImage = async (libdragonInfo, newImageName) => {
  // Will not take too much time if already have the same
  const download = async () => {
    log(`Downloading docker image: ${newImageName}`);
    await spawnProcess('docker', ['pull', newImageName], {
      // We don't need to read them, let it show the user
      inheritStdout: true,
      inheritStderr: true,
    });
  };

  const getDigest = async () =>
    await spawnProcess('docker', ['images', '-q', '--no-trunc', newImageName]);

  // Attempt to compare digests if the new image name is the same
  // Even if they are not the same tag, it is possible to have a different
  // image but we already attempt a download in any case. It would just take
  // less time as we already have the layers.
  if (libdragonInfo.imageName === newImageName) {
    const existingDigest = await getDigest();
    await download();
    const newDigest = await getDigest();

    if (existingDigest === newDigest) {
      log(`Image is the same: ${newImageName}`, true);
      return false;
    }
  } else {
    await download();
  }

  log(`Image is different: ${newImageName}`, true);
  return newImageName;
};

const destroyContainer = async (libdragonInfo) => {
  if (libdragonInfo.containerId) {
    await spawnProcess('docker', [
      'container',
      'rm',
      libdragonInfo.containerId,
      '--force',
    ]);
  }

  await checkContainerAndClean({
    ...libdragonInfo,
    containerId: undefined, // We just destroyed it
  });
};

/**
 * Invokes host git with provided params. If host does not have git, falls back
 * to the docker git, with the nix user set to the user running libdragon.
 */
async function runGitMaybeHost(libdragonInfo, params, options = {}) {
  assert(
    libdragonInfo.vendorStrategy !== 'manual',
    new Error('Should never run git if vendoring strategy is manual.')
  );
  try {
    const isWin = /^win/.test(process.platform);
    return await spawnProcess(
      'git',
      ['-C', libdragonInfo.root, ...params],
      // Windows git is breaking the TTY somehow - disable TTY for now
      // We are not able to display progress for the initial clone b/c of this
      // Enable progress otherwise.
      isWin
        ? { inheritStdin: false, ...options }
        : { inheritStdout: true, inheritStderr: true, ...options }
    );
  } catch (e) {
    if (e instanceof CommandError) {
      throw e;
    }

    return await dockerExec(
      libdragonInfo,
      // Use the host user when initializing git as we will need access
      [...dockerHostUserParams(libdragonInfo)],
      ['git', ...params],
      // Let's enable tty here to show the progress
      { inheritStdout: true, inheritStderr: true, ...options }
    );
  }
}

async function checkContainerAndClean(libdragonInfo) {
  const id =
    libdragonInfo.containerId &&
    (
      await spawnProcess('docker', [
        'container',
        'ls',
        '-qa',
        '-f id=' + libdragonInfo.containerId,
      ])
    ).trim();

  // Container does not exist, clean the id up
  if (!id) {
    const containerIdFile = path.join(
      libdragonInfo.root,
      '.git',
      CACHED_CONTAINER_FILE
    );
    if (await fileExists(containerIdFile)) {
      await fs.rm(containerIdFile);
    }
  }
  return id ? libdragonInfo.containerId : undefined;
}

async function checkContainerRunning(containerId) {
  const running = (
    await spawnProcess('docker', [
      'container',
      'ls',
      '-q',
      '-f id=' + containerId,
    ])
  ).trim();
  return running ? containerId : undefined;
}

async function initGitAndCacheContainerId(libdragonInfo) {
  // If there is managed vendoring, make sure we have a git repo. `git init` is
  // safe anyways...
  if (libdragonInfo.vendorStrategy !== 'manual') {
    await runGitMaybeHost(libdragonInfo, ['init']);
  }
  const gitFolder = path.join(libdragonInfo.root, '.git');
  if (await dirExists(gitFolder)) {
    await fs.writeFile(
      path.join(gitFolder, CACHED_CONTAINER_FILE),
      libdragonInfo.containerId
    );
  }
}

module.exports = {
  installDependencies,
  updateImage,
  destroyContainer,
  checkContainerRunning,
  checkContainerAndClean,
  initGitAndCacheContainerId,
  runGitMaybeHost,
};

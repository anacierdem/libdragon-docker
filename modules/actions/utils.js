const path = require('path');
const fs = require('fs/promises');

const {
  CONTAINER_TARGET_PATH,
  CACHED_CONTAINER_FILE,
} = require('../constants');

const {
  fileExists,
  log,
  toPosixPath,
  spawnProcess,
  dockerExec,
  dirExists,
  assert,
  CommandError,
  ValidationError,
  ParameterError,
} = require('../helpers');

const { installNPMDependencies } = require('./npm-utils');

function dockerHostUserParams(libdragonInfo) {
  const { uid, gid } = libdragonInfo.userInfo;
  return ['-u', `${uid >= 0 ? uid : ''}:${gid >= 0 ? gid : ''}`];
}

const installDependencies = async (libdragonInfo) => {
  const buildScriptPath = path.join(
    libdragonInfo.root,
    libdragonInfo.vendorDirectory,
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
      CONTAINER_TARGET_PATH +
        '/' +
        toPosixPath(
          path.relative(libdragonInfo.root, libdragonInfo.vendorDirectory)
        ),
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
    libdragonInfo.showStatus &&
      log(`Downloading docker image: ${newImageName}`);
    await spawnProcess(
      'docker',
      ['pull', newImageName],
      false,
      libdragonInfo.showStatus
    );
  };

  const getDigest = async () =>
    await spawnProcess(
      'docker',
      ['images', '-q', '--no-trunc', newImageName],
      false,
      false
    );

  // Attempt to compare digests if the new image name is the same
  // Even if they are not the same tag, it is possible to have a different
  // image but we already attempt a download in any case. It would just take
  // less time as we already have the layers.
  if (libdragonInfo.imageName === newImageName) {
    const existingDigest = await getDigest();
    await download();
    const newDigest = await getDigest();

    if (existingDigest === newDigest) {
      libdragonInfo.showStatus &&
        log(`Image is the same: ${newImageName}`, true);
      return false;
    }
  } else {
    await download();
  }

  libdragonInfo.showStatus && log(`Image is different: ${newImageName}`, true);
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
async function runGitMaybeHost(libdragonInfo, params, interactive = 'full') {
  assert(
    libdragonInfo.vendorStrategy !== 'manual',
    new Error('Should never run git if vendoring strategy is manual.')
  );
  try {
    return await spawnProcess(
      'git',
      ['-C', libdragonInfo.root, ...params],
      false,
      // Windows git is breaking the TTY somehow - disable interactive for now
      // We are not able to display progress for the initial clone b/c of this
      /^win/.test(process.platform) ? false : interactive
    );
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

async function tryCacheContainerId(libdragonInfo) {
  const gitFolder = path.join(libdragonInfo.root, '.git');
  if (await dirExists(gitFolder)) {
    await fs.writeFile(
      path.join(gitFolder, CACHED_CONTAINER_FILE),
      libdragonInfo.containerId
    );
  }
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
  updateImage,
  destroyContainer,
  checkContainerRunning,
  checkContainerAndClean,
  dockerHostUserParams,
  tryCacheContainerId,
  runGitMaybeHost,
  mustHaveProject,
};

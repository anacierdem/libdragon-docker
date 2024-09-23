const path = require('path');
const fs = require('fs/promises');

const { CONTAINER_TARGET_PATH, CACHED_CONTAINER_FILE } = require('./constants');

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
} = require('./helpers');

const { dockerHostUserParams } = require('./docker-utils');
const { installNPMDependencies } = require('./npm-utils');

/**
 * @param {import('./project-info').LibdragonInfo} libdragonInfo
 */
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
 * same, true otherwise.
 * @param {import('./project-info').LibdragonInfo} libdragonInfo
 * @param {string} newImageName
 */
const updateImage = async (libdragonInfo, newImageName) => {
  assert(
    !process.env.DOCKER_CONTAINER,
    new Error('[updateImage] should not be called in a container')
  );

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
  return true;
};

/**
 * @param {import('./project-info').LibdragonInfo} libdragonInfo
 */
const destroyContainer = async (libdragonInfo) => {
  assert(
    !process.env.DOCKER_CONTAINER,
    new Error('[destroyContainer] should not be called in a container')
  );

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

/**
 *
 * @param {import('./project-info').LibdragonInfo} libdragonInfo
 * @param {string[]} params
 * @param {import('./helpers').SpawnOptions} options
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

    assert(
      !process.env.DOCKER_CONTAINER,
      new Error('[runGitMaybeHost] Native git should exist in a container.')
    );

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

/**
 * @param {import('./project-info').LibdragonInfo} libdragonInfo
 */
async function checkContainerAndClean(libdragonInfo) {
  assert(
    !process.env.DOCKER_CONTAINER,
    new Error(
      '[checkContainerAndClean] We should already know we are in a container.'
    )
  );

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

/**
 * @param {string} containerId
 */
async function checkContainerRunning(containerId) {
  assert(
    !process.env.DOCKER_CONTAINER,
    new Error(
      '[checkContainerRunning] We should already know we are in a container.'
    )
  );

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

/**
 * @param {import('./project-info').LibdragonInfo & {containerId: string}} libdragonInfo
 */
async function initGitAndCacheContainerId(libdragonInfo) {
  if (!libdragonInfo.containerId) {
    return;
  }

  // If there is managed vendoring, make sure we have a git repo.
  if (libdragonInfo.vendorStrategy !== 'manual') {
    await ensureGit(libdragonInfo);
  }

  const rootGitFolder = (
    await spawnProcess('git', [
      'rev-parse',
      '--show-superproject-working-tree',
    ]).catch(() => {
      // Probably host does not have git, can ignore
      return '';
    })
  ).trim();

  // Fallback to the potential git root on the project root if there is no parent
  // git project.
  const gitFolder = path.join(rootGitFolder || libdragonInfo.root, '.git');
  if (await dirExists(gitFolder)) {
    await fs.writeFile(
      path.join(gitFolder, CACHED_CONTAINER_FILE),
      libdragonInfo.containerId
    );
  }
}

/**
 * Makes sure there is a parent git repository. If not, it will create one at
 * project root.
 * @param {import('./project-info').LibdragonInfo} info
 */
async function ensureGit(info) {
  const gitRoot = (
    await runGitMaybeHost(info, ['rev-parse', '--show-toplevel'], {
      inheritStdin: false,
      inheritStdout: false,
      inheritStderr: false,
    }).catch(() => {
      // Probably host does not have git, can ignore
      return '';
    })
  ).trim();

  // If the host does not have git installed, this will not run unless we
  // have already initialized it via the container, in which case we would
  // have it as the git root. This is not expected to mess with host git flows
  // where there is a git working tree higher in the host filesystem, which
  // the container does not have access to.
  if (!gitRoot) {
    await runGitMaybeHost(info, ['init']);
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
  ensureGit,
};

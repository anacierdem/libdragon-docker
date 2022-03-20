const path = require('path');
const fsClassic = require('fs');
const fs = require('fs/promises');

const _ = require('lodash');

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
} = require('../helpers');

function dockerHostUserParams(libdragonInfo) {
  const { uid, gid } = libdragonInfo.userInfo;
  return ['-u', `${uid >= 0 ? uid : ''}:${gid >= 0 ? gid : ''}`];
}

async function findNPMRoot() {
  try {
    const root = path.resolve((await runNPM(['root'])).trim(), '..');
    // Only report if package.json really exists. npm fallbacks to cwd
    if (await fileExists(path.join(root, 'package.json'))) {
      return root;
    }
  } catch {
    // User does not have and does not care about NPM if it didn't work
    return undefined;
  }
}

const installDependencies = async (libdragonInfo) => {
  let buildScriptPath;
  if (path.isAbsolute(libdragonInfo.vendorDirectory)) {
    buildScriptPath = path.join(libdragonInfo.vendorDirectory, 'build.sh');
  } else {
    buildScriptPath = path.join(
      libdragonInfo.root,
      libdragonInfo.vendorDirectory,
      'build.sh'
    );
  }
  if (!(await fileExists(buildScriptPath))) {
    throw new Error(
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

  // Install other NPM dependencies if this is an NPM project
  const npmRoot = await findNPMRoot();
  if (npmRoot) {
    const packageJsonPath = path.join(npmRoot, 'package.json');

    const { dependencies, devDependencies } = require(packageJsonPath);

    const deps = await Promise.all(
      Object.keys({
        ...dependencies,
        ...devDependencies,
      })
        .filter((dep) => dep !== 'libdragon')
        .map(async (dep) => {
          const npmPath = await runNPM(['ls', dep, '--parseable=true']);
          return {
            name: dep,
            paths: _.uniq(npmPath.split('\n').filter((f) => f)),
          };
        })
    );

    await Promise.all(
      deps.map(({ name, paths }) => {
        return new Promise((resolve, reject) => {
          fsClassic.access(
            path.join(paths[0], 'Makefile'),
            fsClassic.F_OK,
            async (e) => {
              if (e) {
                // File does not exist - skip
                resolve();
                return;
              }

              if (paths.length > 1) {
                reject(
                  new Error(
                    `Using same dependency with different versions is not supported! ${name}`
                  )
                );
                return;
              }

              try {
                const relativePath = toPosixPath(
                  path.relative(libdragonInfo.root, paths[0])
                );
                const containerPath = path.posix.join(
                  CONTAINER_TARGET_PATH,
                  relativePath
                );
                const makePath = path.posix.join(containerPath, 'Makefile');

                await dockerExec(
                  libdragonInfo,
                  [...dockerHostUserParams(libdragonInfo)],
                  [
                    '/bin/bash',
                    '-c',
                    '[ -f ' +
                      makePath +
                      ' ] && make -C ' +
                      containerPath +
                      ' && make -C ' +
                      containerPath +
                      ' install',
                  ]
                );

                resolve();
              } catch (e) {
                reject(e);
              }
            }
          );
        });
      })
    );
  }
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
      libdragonInfo.showStatus
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
      libdragonInfo.showStatus && log(`Image is the same: ${newImageName}`);
      return false;
    }
  } else {
    await download();
  }

  libdragonInfo.showStatus && log(`Image is different: ${newImageName}`);
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
      params,
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

function runNPM(params) {
  return spawnProcess(
    /^win/.test(process.platform) ? 'npm.cmd' : 'npm',
    params
  );
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

module.exports = {
  installDependencies,
  updateImage,
  destroyContainer,
  checkContainerRunning,
  checkContainerAndClean,
  dockerHostUserParams,
  tryCacheContainerId,
  runGitMaybeHost,
  findNPMRoot,
};

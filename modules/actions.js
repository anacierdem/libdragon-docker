const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');

const {
  LIBDRAGON_SUBMODULE,
  LIBDRAGON_BRANCH,
  LIBDRAGON_GIT,
  CONTAINER_TARGET_PATH,
  LIBDRAGON_PROJECT_MANIFEST,
} = require('./constants');

const {
  spawnProcess,
  checkContainerAndClean,
  checkContainerRunning,
  toPosixPath,
  setProjectInfoToSave,
  runNPM,
  findNPMRoot,
  log,
  dockerExec,
  dockerRelativeWorkdirParams,
  runGitMaybeHost,
  dockerHostUserParams,
  dockerRelativeWorkdir,
  tryCacheContainerId,
  fileExists,
} = require('./helpers');

const { printUsage } = require('./usage');

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

const initSubmodule = async (libdragonInfo) => {
  await runGitMaybeHost(libdragonInfo, ['init']);

  await runGitMaybeHost(libdragonInfo, [
    'submodule',
    'add',
    '--force',
    '--name',
    LIBDRAGON_SUBMODULE,
    '--branch',
    LIBDRAGON_BRANCH,
    LIBDRAGON_GIT,
    libdragonInfo.vendorDirectory,
  ]);
  return libdragonInfo;
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

/**
 * Create a new container
 */
const initContainer = async (libdragonInfo) => {
  let newId;
  try {
    // Create a new container
    libdragonInfo.showStatus && log('Creating new container...');
    newId = (
      await spawnProcess('docker', [
        'run',
        '-d', // Detached
        '--mount',
        'type=bind,source=' +
          libdragonInfo.root +
          ',target=' +
          CONTAINER_TARGET_PATH, // Mount files
        '-w=' + CONTAINER_TARGET_PATH, // Set working directory
        libdragonInfo.imageName,
        'tail',
        '-f',
        '/dev/null',
      ])
    ).trim();

    const newInfo = {
      ...libdragonInfo,
      containerId: newId,
    };

    // chown the installation folder once on init
    const { uid, gid } = libdragonInfo.userInfo;
    await dockerExec(newInfo, [
      'chown',
      '-R',
      `${uid >= 0 ? uid : ''}:${gid >= 0 ? gid : ''}`,
      '/n64_toolchain',
    ]);
  } catch (e) {
    // Dispose the invalid container, clean and exit
    await destroyContainer({
      ...libdragonInfo,
      containerId: newId,
    });
    log(
      chalk.red(
        'We were unable to initialize libdragon. Done cleanup. Check following logs for the actual error.'
      )
    );
    throw e;
  }

  const name = await spawnProcess('docker', [
    'container',
    'inspect',
    newId,
    '--format',
    '{{.Name}}',
  ]);

  libdragonInfo.showStatus &&
    log(
      chalk.green(`Successfully initialized docker container: ${name.trim()}`)
    );

  // Schedule an update to write image name
  setProjectInfoToSave(libdragonInfo);
  return newId;
};

/**
 * Recursively copies directories and files
 */
async function copyDirContents(src, dst) {
  log(`Copying from ${src} to ${dst}`, true);

  const dstStat = await fsp.stat(dst).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    return null;
  });

  if (dstStat && !dstStat.isDirectory()) {
    log(`${dst} is not a directory, skipping.`);
    return;
  }

  if (!dstStat) {
    log(`Creating a directory at ${dst}.`, true);
    await fsp.mkdir(dst);
  }

  const files = await fsp.readdir(src);
  return Promise.all(
    files.map(async (name) => {
      const source = path.join(src, name);
      const dest = path.join(dst, name);
      const stats = await fsp.stat(source);
      if (stats.isDirectory()) {
        await copyDirContents(source, dest);
      } else if (stats.isFile()) {
        const content = await fsp.readFile(source);
        try {
          log(`Writing to ${dest}`, true);
          await fsp.writeFile(dest, content, {
            flag: 'wx',
          });
        } catch (e) {
          log(`${dest} already exists, skipping.`);
          return;
        }
      }
    })
  );
}

/**
 * Initialize a new libdragon project in current working directory
 * Also downloads the image
 */
async function init(libdragonInfo) {
  log(`Initializing a libdragon project at ${libdragonInfo.root}`);

  // TODO: use exists instead & check if it is a directory
  const files = await fsp.readdir(libdragonInfo.root);

  const manifestFile = files.find(
    (name) => name === LIBDRAGON_PROJECT_MANIFEST
  );

  let newInfo = libdragonInfo;

  // Update the directory information for the project if the flag is provided
  if (libdragonInfo.options.VENDOR_DIR) {
    newInfo = setProjectInfoToSave({
      ...newInfo,
      vendorDirectory: libdragonInfo.options.VENDOR_DIR,
    });
  }

  // Update the strategy information for the project if the flag is provided
  if (libdragonInfo.options.VENDOR_STRAT) {
    newInfo = setProjectInfoToSave({
      ...newInfo,
      vendorStrategy: libdragonInfo.options.VENDOR_STRAT,
    });
  }

  if (manifestFile) {
    log(
      `${path.join(
        newInfo.root,
        manifestFile
      )} exists. This is already a libdragon project, starting it...`
    );
    if (newInfo.options.DOCKER_IMAGE) {
      log(
        `Not changing docker image. Use the install action if you want to override the image.`
      );
    }
    await install(newInfo);
    return;
  }

  // Download image and start it
  const containerReadyPromise = start({
    ...newInfo,
    imageName:
      (await updateImage(newInfo, newInfo.imageName)) || newInfo.imageName,
  });

  let vendorAndGitReadyPromise = containerReadyPromise;
  if (newInfo.vendorStrategy === 'submodule') {
    const relativePath = path.relative(newInfo.root, newInfo.vendorDirectory);

    if (relativePath.startsWith('..')) {
      throw new Error(
        'When using `submodule` strategy, `--directory` must be inside the project folder.'
      );
    }

    const libdragonFile = files.find((name) =>
      name.match(new RegExp(`^${relativePath}.?`))
    );

    if (libdragonFile) {
      throw new Error(
        `${path.join(
          newInfo.root,
          libdragonFile
        )} already exists. That is the libdragon vendoring target, please remove and retry. Move libdragon.exe to somewhere else if you are trying to use it inside your project folder.`
      );
    }

    vendorAndGitReadyPromise = containerReadyPromise.then((newId) =>
      initSubmodule({
        ...newInfo,
        containerId: newId,
      })
    );
  }

  log(`Preparing project files...`);
  const skeletonFolder = path.join(__dirname, '../skeleton');

  await Promise.all([
    // We have created a new container, save the new info
    vendorAndGitReadyPromise.then(tryCacheContainerId),
    vendorAndGitReadyPromise.then(installDependencies),
    // node copy functions does not work with pkg
    copyDirContents(skeletonFolder, newInfo.root),
  ]);

  log(chalk.green(`libdragon ready at \`${newInfo.root}\`.`));
}

const start = async (libdragonInfo) => {
  const running =
    libdragonInfo.containerId &&
    (await checkContainerRunning(libdragonInfo.containerId));

  if (running) {
    log(`Container ${running} already running.`, true);
    log(libdragonInfo.containerId);
    return running;
  }

  let id = await checkContainerAndClean(libdragonInfo);

  if (!id) {
    log(`Container does not exist, re-initializing...`, true);
    id = await initContainer(libdragonInfo);
    log(id);
    return id;
  }

  log(`Starting container: ${id}`, true);
  await spawnProcess('docker', ['container', 'start', id]);

  log(id);
  return id;
};

const stop = async (libdragonInfo) => {
  const running =
    libdragonInfo.containerId &&
    (await checkContainerRunning(libdragonInfo.containerId));
  if (!running) {
    return;
  }

  await spawnProcess('docker', ['container', 'stop', running]);
};

const exec = async (libdragonInfo, commandAndParams) => {
  log(
    `Running ${commandAndParams[0]} at ${dockerRelativeWorkdir(
      libdragonInfo
    )} with [${commandAndParams.slice(1)}]`,
    true
  );

  const tryCmd = (libdragonInfo) =>
    libdragonInfo.containerId &&
    dockerExec(
      libdragonInfo,
      [
        ...dockerRelativeWorkdirParams(libdragonInfo),
        ...dockerHostUserParams(libdragonInfo),
      ],
      commandAndParams,
      true,
      true // Cannot use "full" here, we need to know if the container is alive
    );

  let started = false;
  const startOnceAndCmd = async () => {
    if (!started) {
      const newId = await start(libdragonInfo);
      started = true;
      await tryCmd({
        ...libdragonInfo,
        containerId: newId,
      });
      return newId;
    }
  };

  if (!libdragonInfo.containerId) {
    log(`Container does not exist for sure, restart`, true);
    await startOnceAndCmd();
    return;
  }

  try {
    await tryCmd(libdragonInfo);
  } catch (e) {
    if (
      !e.out ||
      // TODO: is there a better way?
      !e.out.toString().includes(libdragonInfo.containerId)
    ) {
      throw e;
    }
    await startOnceAndCmd();
  }
};

const make = async (libdragonInfo, params) => {
  await exec(libdragonInfo, ['make', ...params]);
};

const installDependencies = async (libdragonInfo) => {
  const buildScriptPath = path.join(
    path.relative(libdragonInfo.root, libdragonInfo.vendorDirectory),
    'build.sh'
  );
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
          fs.access(path.join(paths[0], 'Makefile'), fs.F_OK, async (e) => {
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
          });
        });
      })
    );
  }
};

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

/**
 * Updates the image if flag is provided and install vendors onto the container.
 * We should probably remove the image installation responsibility from this
 * action but it might be a breaking change. Maybe we can keep it backward
 * compatible with additional flags.
 * @param libdragonInfo
 */
const install = async (libdragonInfo) => {
  let containerId;
  const oldImageName = libdragonInfo.imageName;
  const imageName = libdragonInfo.options.DOCKER_IMAGE;
  // If an image is provided, always attempt to install it
  // See https://github.com/anacierdem/libdragon-docker/issues/47
  if (imageName) {
    log(`Changing image from \`${oldImageName}\` to \`${imageName}\``);

    // Download the new image and if it is different, re-create the container
    if (await updateImage(libdragonInfo, imageName)) {
      await destroyContainer(libdragonInfo);
    }

    containerId = await start({
      ...libdragonInfo,
      imageName,
    });
  } else {
    // Make sure existing one is running
    containerId = await start(libdragonInfo);
  }

  // Re-install vendors on new image
  // TODO: skip this if unnecessary
  await installDependencies({
    ...libdragonInfo,
    imageName,
    containerId,
  });
};

// TODO: separate into files
module.exports = {
  start: {
    name: 'start',
    fn: start,
    showStatus: false, // This will only print out the id
  },
  init: {
    name: 'init',
    fn: init,
    showStatus: true,
  },
  make: {
    name: 'make',
    fn: make,
    forwardsRestParams: true,
    showStatus: true,
  },
  exec: {
    name: 'exec',
    fn: exec,
    forwardsRestParams: true,
    showStatus: true,
  },
  stop: {
    name: 'stop',
    fn: stop,
    showStatus: false, // This will only print out the id
  },
  install: {
    name: 'install',
    fn: install,
    showStatus: true,
  },
  update: {
    name: 'update',
    fn: update,
    showStatus: true,
  },
  help: {
    name: 'help',
    fn: printUsage,
    showStatus: true,
    forwardsRestParams: true,
  },
};

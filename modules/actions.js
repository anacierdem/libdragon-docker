const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const {
  LIBDRAGON_SUBMODULE,
  LIBDRAGON_BRANCH,
  LIBDRAGON_GIT,
  CACHED_CONTAINER_FILE,
} = require('./constants');
const {
  spawnProcess,
  checkContainerAndClean,
  checkContainerRunning,
  toPosixPath,
  updateImageName,
  createManifestIfNotExist,
  runNPM,
  findNPMRoot,
  log,
  dockerExec,
  dockerRelativeWorkdirParams,
  dockerByteSwapParams,
  runGitMaybeHost,
  dockerHostUserParams,
} = require('./helpers');

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
  // Try to make sure submodule is there, in case it is deleted manually
  try {
    await runGitMaybeHost(libdragonInfo, ['restore', '.gitmodules']);
  } catch {
    // No need to do anything else here
  }
  await runGitMaybeHost(libdragonInfo, [
    'submodule',
    'add',
    '--force',
    '--name',
    LIBDRAGON_SUBMODULE,
    '--branch',
    LIBDRAGON_BRANCH,
    LIBDRAGON_GIT,
    LIBDRAGON_SUBMODULE,
  ]);
};

/**
 * Will donload image, create a new container and install everything in it
 */
const initContainer = async (libdragonInfo) => {
  let newId;
  try {
    const imageName = await updateImageName(libdragonInfo);

    // Download image
    libdragonInfo.showStatus && log(`Downloading docker image: ${imageName}`);
    await spawnProcess('docker', ['pull', imageName]);

    // Create a new container
    libdragonInfo.showStatus && log('Creating new container...');
    newId = (
      await spawnProcess('docker', [
        'run',
        ...dockerByteSwapParams(libdragonInfo),
        '-d', // Detached
        '--mount',
        'type=bind,source=' + libdragonInfo.root + ',target=/libdragon', // Mount files
        '-w=/libdragon', // Set working directory
        imageName,
        'tail',
        '-f',
        '/dev/null',
      ])
    ).trim();

    const newInfo = {
      ...libdragonInfo,
      containerId: newId,
      imageName,
    };

    // chown the installation folder once on init
    const { uid, gid } = libdragonInfo.userInfo;
    await dockerExec(newInfo, [
      'chown',
      '-R',
      `${uid >= 0 ? uid : ''}:${gid >= 0 ? gid : ''}`,
      '/n64_toolchain',
    ]);

    await runGitMaybeHost(libdragonInfo, ['init']);
    await initSubmodule(libdragonInfo);

    await installDependencies(newInfo);
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

  // We have created a new container, save the new info
  fs.writeFileSync(
    path.join(libdragonInfo.root, '.git', CACHED_CONTAINER_FILE),
    newId
  );
  libdragonInfo.showStatus &&
    log(
      chalk.green(`Successfully initialized docker container: ${name.trim()}`)
    );
  return newId;
};

/**
 * Recursively copies directories and files
 */
function copyDirContents(src, dst) {
  if (fs.existsSync(dst) && !fs.statSync(dst).isDirectory()) {
    log(`${dst} is not a directory, skipping.`);
    return;
  }

  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst);
  }

  const files = fs.readdirSync(src);
  files.forEach((name) => {
    const source = path.join(src, name);
    const dest = path.join(dst, name);
    const stats = fs.statSync(source);
    if (stats.isDirectory()) {
      copyDirContents(source, dest);
    } else if (stats.isFile()) {
      const content = fs.readFileSync(source);
      try {
        fs.writeFileSync(dest, content, {
          flag: 'wx',
        });
      } catch (e) {
        log(`${dest} already exists, skipping.`);
        return;
      }
    }
  });
}

/**
 * Initialize a new libdragon project in current working directory
 */
async function init(libdragonInfo) {
  log(`Initializing a libdragon project at ${libdragonInfo.root}.`);
  const isNewProject = await createManifestIfNotExist(libdragonInfo);

  log(`Preparing the docker container...`);
  await start(libdragonInfo);

  if (isNewProject) {
    log(`Copying project files...`);
    const skeletonFolder = path.join(__dirname, '../skeleton');
    // node copy functions does not work with pkg
    copyDirContents(skeletonFolder, libdragonInfo.root);
  }

  log(chalk.green(`libdragon ready at \`${libdragonInfo.root}\`.`));
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

  log(`Starting container: ${libdragonInfo.containerId}`, true);
  await spawnProcess('docker', [
    'container',
    'start',
    libdragonInfo.containerId,
  ]);

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

const make = async (libdragonInfo, params) => {
  const workdir = toPosixPath(path.relative(libdragonInfo.root, process.cwd()));
  log(`Running make at ${workdir ?? '.'} with [${params}]`, true);

  const tryMake = (libdragonInfo) =>
    libdragonInfo.containerId &&
    dockerExec(
      libdragonInfo,
      [
        ...dockerRelativeWorkdirParams(libdragonInfo),
        ...dockerByteSwapParams(libdragonInfo),
        ...dockerHostUserParams(libdragonInfo),
      ],
      ['make', ...params],
      true
    );

  let started = false;
  const startOnceAndMake = async () => {
    if (!started) {
      const newId = await start(libdragonInfo);
      started = true;
      await tryMake({
        ...libdragonInfo,
        containerId: newId,
      });
      return newId;
    }
  };

  if (!libdragonInfo.containerId) {
    log(`Container does not exist for sure, restart`, true);
    await startOnceAndMake();
    return;
  }

  try {
    await tryMake(libdragonInfo);
  } catch (e) {
    if (
      !e.out ||
      // TODO: is there a better way?
      !e.out.toString().includes(libdragonInfo.containerId)
    ) {
      throw e;
    }
    await startOnceAndMake();
  }
};

const installDependencies = async (libdragonInfo) => {
  libdragonInfo.showStatus && log('Vendoring libdragon...');

  await dockerExec(
    libdragonInfo,
    [
      '--workdir',
      '/libdragon/' + LIBDRAGON_SUBMODULE,
      ...dockerByteSwapParams(libdragonInfo),
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
              const containerPath = path.posix.join('/libdragon', relativePath);
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

const requiresContainer = async (libdragonInfo) => {
  const id = await checkContainerAndClean(libdragonInfo);

  if (!id) {
    throw new Error(
      'libdragon is not properly initialized. Initialize with `libdragon init` first.'
    );
  }

  return id;
};

const maybeStartNewImage = async (libdragonInfo) => {
  let containerId = libdragonInfo.containerId;
  const oldImageName = libdragonInfo.imageName;
  const imageName = await updateImageName(libdragonInfo);
  if (oldImageName !== imageName) {
    log(`Changing image from \`${oldImageName}\` to \`${imageName}\``);
    await destroyContainer(libdragonInfo);

    // Start the new image
    containerId = await start({
      ...libdragonInfo,
      imageName,
    });
  }

  return {
    ...libdragonInfo,
    imageName,
    containerId,
  };
};

const update = async (libdragonInfo) => {
  let containerId = await requiresContainer(libdragonInfo);

  // Start existing
  containerId = await start(libdragonInfo);

  // Update submodule
  log('Updating submodule...');

  await initSubmodule(libdragonInfo);

  await runGitMaybeHost(libdragonInfo, [
    'submodule',
    'update',
    '--remote',
    '--merge',
    './' + LIBDRAGON_SUBMODULE,
  ]);

  await install({
    ...libdragonInfo,
    containerId,
  });
};

const install = async (libdragonInfo) => {
  let containerId = await requiresContainer(libdragonInfo);

  const newInfo = await maybeStartNewImage({
    ...libdragonInfo,
    containerId,
  });

  // Re-install vendors on new image
  await installDependencies(newInfo);
};

const help = () => {
  log(`${chalk.green('Usage:')}
  libdragon [flags] <action>

${chalk.green('Available Commands:')}
  help        Display this help information.
  init        Create a libdragon project in the current directory.
  make        Run the libdragon build system in the current directory.
  start       Start the container for current project.
  stop        Stop the container for current project.
  install     Vendor libdragon as is.
  update      Update libdragon and do an install.

${chalk.green('Flags:')}
  --image <docker-image>  Provide a custom image.
  --byte-swap             Enable byte-swapped ROM output.
  --verbose               Be verbose
`);
};

module.exports = {
  start: {
    fn: start,
    showStatus: false, // This will only print out the id
  },
  init: {
    fn: init,
    showStatus: true,
  },
  make: {
    fn: make,
    forwardsRestParams: true,
    showStatus: true,
  },
  stop: {
    fn: stop,
    showStatus: false, // This will only print out the id
  },
  install: {
    fn: install,
    showStatus: true,
  },
  update: {
    fn: update,
    showStatus: true,
  },
  help: {
    fn: help,
    showStatus: true,
  },
};

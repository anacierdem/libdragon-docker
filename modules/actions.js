const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const {
  LIBDRAGON_SUBMODULE,
  LIBDRAGON_BRANCH,
  LIBDRAGON_GIT,
  CONTAINER_TARGET_PATH,
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
  runGitMaybeHost,
  dockerHostUserParams,
  dockerRelativeWorkdir,
  tryCacheContainerId,
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
    await runGitMaybeHost(libdragonInfo, ['restore', '.gitmodules'], true);
  } catch {
    // No need to do anything else here
  }
  await runGitMaybeHost(
    libdragonInfo,
    [
      'submodule',
      'add',
      '--force',
      '--name',
      LIBDRAGON_SUBMODULE,
      '--branch',
      LIBDRAGON_BRANCH,
      LIBDRAGON_GIT,
      LIBDRAGON_SUBMODULE,
    ],
    true
  );
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
    await spawnProcess(
      'docker',
      ['pull', imageName],
      false,
      libdragonInfo.showStatus
    );

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
  tryCacheContainerId({
    ...libdragonInfo,
    containerId: newId,
  });

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
  log(`Copying from ${src} to ${dst}`, true);

  if (fs.existsSync(dst) && !fs.statSync(dst).isDirectory()) {
    log(`${dst} is not a directory, skipping.`);
    return;
  }

  if (!fs.existsSync(dst)) {
    log(`Creating a directory at ${dst}.`, true);
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
        log(`Writing to ${dest}`, true);
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

  const newId = await start(libdragonInfo);
  const newInfo = {
    ...libdragonInfo,
    containerId: newId,
  };

  await initSubmodule(newInfo);
  await installDependencies(newInfo);

  if (isNewProject) {
    log(`Copying project files...`);
    const skeletonFolder = path.join(__dirname, '../skeleton');
    // node copy functions does not work with pkg
    copyDirContents(skeletonFolder, newInfo.root);
  }

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
      const newId = await startAndInstall(libdragonInfo);
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
    libdragonInfo.root,
    'libdragon',
    'build.sh'
  );
  if (
    !fs.existsSync(buildScriptPath) ||
    !fs.statSync(buildScriptPath).isFile()
  ) {
    throw new Error(
      'build.sh not found. Make sure you have a vendored libdragon copy at ./libdragon'
    );
  }

  libdragonInfo.showStatus && log('Installing libdragon to the container...');

  await dockerExec(
    libdragonInfo,
    [
      '--workdir',
      CONTAINER_TARGET_PATH + '/' + LIBDRAGON_SUBMODULE,
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

async function startAndInstall(libdragonInfo) {
  const containerId = await start(libdragonInfo);

  await installDependencies({
    ...libdragonInfo,
    containerId,
  });
  return containerId;
}

const requiresContainer = async (libdragonInfo) => {
  const id = await checkContainerAndClean(libdragonInfo);

  if (!id) {
    throw new Error(
      'libdragon is not properly initialized. Initialize with `libdragon init` first.'
    );
  }

  return id;
};

const update = async (libdragonInfo) => {
  let containerId = await requiresContainer(libdragonInfo);

  // Start existing
  containerId = await startAndInstall({
    ...libdragonInfo,
    containerId,
  });
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

  const oldImageName = libdragonInfo.imageName;
  const imageName = await updateImageName(libdragonInfo);
  if (oldImageName !== imageName) {
    log(`Changing image from \`${oldImageName}\` to \`${imageName}\``);
    await destroyContainer(libdragonInfo);

    containerId = await start({
      ...libdragonInfo,
      imageName,
    });
  }

  // Re-install vendors on new image
  await installDependencies({
    ...libdragonInfo,
    imageName,
    containerId,
  });
};

const help = () => {
  log(`${chalk.green('Usage:')}
  libdragon [flags] <action>

${chalk.green('Available Commands:')}
  help        Display this help information.
  init        Create a libdragon project in the current directory.
  make        Run the libdragon build system in the current directory.
  exec        Execute given command in the current directory.
  start       Start the container for current project.
  stop        Stop the container for current project.
  install     Vendor libdragon as is.
  update      Update libdragon and do an install.

${chalk.green('Flags:')}
  --image <docker-image>  Provide a custom image.
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
  exec: {
    fn: exec,
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

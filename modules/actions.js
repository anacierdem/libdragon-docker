const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const {
  LIBDRAGON_SUBMODULE,
  LIBDRAGON_BRANCH,
  LIBDRAGON_GIT,
  CACHED_CONTAINER_FILE,
  PROJECT_NAME,
} = require('./constants');
const {
  spawnProcess,
  checkContainerAndClean,
  checkContainerRunning,
  withProject,
  toPosixPath,
  updateImageName,
  createManifestIfNotExist,
  runNPM,
  findNPMRoot,
  log,
} = require('./helpers');

const destroyContainer = async (libdragonInfo) => {
  await spawnProcess('docker', [
    'container',
    'rm',
    libdragonInfo.containerId,
    '--force',
  ]);
  await checkContainerAndClean({
    ...libdragonInfo,
    containerId: undefined, // We just destroyed it
  });
};

/**
 * Will donload image, create a new container and install everything in it
 */
const initContainer = withProject(async (libdragonInfo) => {
  let newId;
  try {
    const imageName = await updateImageName(libdragonInfo);

    // Download image
    log(`Downloading docker image: ${imageName}`);
    await spawnProcess('docker', ['pull', imageName]);

    // Create a new container
    log('Creating new container...');
    newId = (
      await spawnProcess('docker', [
        'run',
        ...(libdragonInfo.options.BYTE_SWAP
          ? ['-e', 'N64_BYTE_SWAP=true']
          : []),
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

    await spawnProcess('docker', ['exec', newId, 'git', 'init']);

    // Add the submodule
    await spawnProcess('docker', [
      'exec',
      newId,
      'git',
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

    await installDependencies({
      ...libdragonInfo,
      containerId: newId,
      imageName,
    });
  } catch {
    // Dispose the invalid container, clean and exit
    await destroyContainer({
      ...libdragonInfo,
      containerId: newId,
    });
    throw new Error('We were unable to initialize libdragon. Done cleanup.');
  }

  await spawnProcess('ls', ['-la', './']);

  console.log(
    'libdragonInfo.root',
    libdragonInfo.root,
    CACHED_CONTAINER_FILE,
    path.resolve(libdragonInfo.root, '.git', CACHED_CONTAINER_FILE),
    fs.existsSync(
      path.resolve(libdragonInfo.root, '.git', CACHED_CONTAINER_FILE)
    ),
    fs.existsSync(path.resolve(libdragonInfo.root, '.git'))
  );

  // We have created a new container, save the new info
  fs.writeFileSync(
    path.resolve(libdragonInfo.root, '.git', CACHED_CONTAINER_FILE),
    newId
  );
  log(chalk.green('Successfully initialized docker container.'));
  return newId;
});

/**
 * Initialize a new libdragon project in current working directory
 */
async function init(libdragonInfo) {
  log(`Initializing a libdragon project at ${libdragonInfo.root}.`);
  await createManifestIfNotExist(libdragonInfo);

  log(`Preparing the docker container...`);
  await start(libdragonInfo);

  log(chalk.green(`libdragon ready at \`${libdragonInfo.root}\`.\n`));
}

const start = withProject(async (libdragonInfo) => {
  const running =
    libdragonInfo.containerId &&
    (await checkContainerRunning(libdragonInfo.containerId));

  if (running) {
    log(`Container ${running} already running.`, true);
    return running;
  }

  let id = await checkContainerAndClean(libdragonInfo);

  if (!id) {
    log(`Container does not exist, re-initializing...`, true);
    id = await initContainer(libdragonInfo);
    return id;
  }

  log(`Starting container: ${libdragonInfo.containerId}`, true);
  await spawnProcess('docker', [
    'container',
    'start',
    libdragonInfo.containerId,
  ]);
  return id;
});

const stop = withProject(async (libdragonInfo) => {
  const running = await checkContainerRunning(libdragonInfo.containerId);
  if (!running) {
    return;
  }

  await spawnProcess('docker', ['container', 'stop', running]);
});

const make = withProject(async (libdragonInfo, params) => {
  const workdir = toPosixPath(path.relative(libdragonInfo.root, process.cwd()));
  log(`Running make at ${workdir} with [${params}]`, true);

  const tryMake = (id) =>
    id &&
    spawnProcess(
      'docker',
      [
        'exec',
        '--workdir',
        '/libdragon/' + workdir,
        ...(libdragonInfo.options.BYTE_SWAP
          ? ['-e', 'N64_BYTE_SWAP=true']
          : []),
        id,
        'make',
        ...params,
      ],
      true // TODO: hide this first error
    );

  let started = false;
  const startOnceAndMake = async () => {
    if (!started) {
      const newId = await start(libdragonInfo);
      started = true;
      await tryMake(newId);
      return newId;
    }
  };

  if (!libdragonInfo.containerId) {
    log(`Container does not exist for sure, restart`, true);
    await startOnceAndMake();
    return;
  }

  try {
    await tryMake(libdragonInfo.containerId);
  } catch (e) {
    if (!e.out.toString().startsWith('Error: No such container:')) {
      throw e;
    }
    await startOnceAndMake();
  }
});

const installDependencies = withProject(async (libdragonInfo) => {
  log('Vendoring libdragon...');

  await spawnProcess('docker', [
    'exec',
    '--workdir',
    '/libdragon/' + LIBDRAGON_SUBMODULE,
    ...(libdragonInfo.options.BYTE_SWAP ? ['-e', 'N64_BYTE_SWAP=true'] : []),
    libdragonInfo.containerId,
    '/bin/bash',
    './build.sh',
  ]);

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
          fs.access(path.resolve(paths[0], 'Makefile'), fs.F_OK, async (e) => {
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

              await spawnProcess('docker', [
                'exec',
                libdragonInfo.containerId,
                '/bin/bash',
                '-c',
                '[ -f ' +
                  makePath +
                  ' ] && make -C ' +
                  containerPath +
                  ' && make -C ' +
                  containerPath +
                  ' install',
              ]);
              resolve();
            } catch (e) {
              reject(e);
            }
          });
        });
      })
    );
  }
});

const update = withProject(async (libdragonInfo) => {
  const oldImageName = libdragonInfo.imageName;
  const imageName = await updateImageName(libdragonInfo);
  if (oldImageName !== imageName) {
    log(`Changing image from \`${oldImageName}\` to \`${imageName}\``);
    await destroyContainer(libdragonInfo);
  }

  // Start the new image
  await start({
    ...libdragonInfo,
    imageName,
  });

  // Update submodule
  log('Updating submodule...');
  await spawnProcess('docker', [
    'exec',
    libdragonInfo.containerId,
    'git',
    'submodule',
    'update',
    '--remote',
    '--merge',
    './' + LIBDRAGON_SUBMODULE,
  ]);

  // Re-install vendors
  await installDependencies(libdragonInfo);

  log(chalk.green('Successfully updated.'));
});

const help = (showTitle) => {
  showTitle &&
    log(`
libdragon docker ${
      PROJECT_NAME === 'libdragon' ? 'v' + process.env.npm_package_version : ''
    }`);

  log(`
${chalk.green('Usage:')}
  libdragon [flags] <command>

${chalk.green('Available Commands:')}
  help        Display this help information.
  init        Create a libdragon project in the current directory.
  make        Run the libdragon build system in the current directory.
  start       Start the container for current project.
  stop        Stop the container for current project.
  update      Update libdragon for current project.

${chalk.green('Flags:')}
  --image <docker-image>  Provide a custom image.
  --byte-swap             Enable byte-swapped ROM output.
  --verbose               Be verbose
  --help                  Display this help information.
`);
};

module.exports = {
  start,
  init,
  make,
  stop,
  update,
  help,
};

const chalk = require('chalk').stderr;

const { CONTAINER_TARGET_PATH } = require('../constants');
const { spawnProcess, log, print, dockerExec } = require('../helpers');

const {
  checkContainerAndClean,
  checkContainerRunning,
  destroyContainer,
} = require('./utils');

/**
 * Create a new container
 */
const initContainer = async (libdragonInfo) => {
  let newId;
  try {
    // Create a new container
    log('Creating new container...');
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

    // chown the installation folder once on init
    const { uid, gid } = libdragonInfo.userInfo;
    await dockerExec(
      {
        ...libdragonInfo,
        containerId: newId,
      },
      [
        'chown',
        '-R',
        `${uid >= 0 ? uid : ''}:${gid >= 0 ? gid : ''}`,
        '/n64_toolchain',
      ]
    );
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

  log(chalk.green(`Successfully initialized docker container: ${name.trim()}`));

  return newId;
};

const start = async (libdragonInfo) => {
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

  log(`Starting container: ${id}`, true);
  await spawnProcess('docker', ['container', 'start', id]);

  return id;
};

module.exports = {
  name: 'start',
  fn: async (libdragonInfo) => {
    const containerId = await start(libdragonInfo);
    print(containerId);
    return { ...libdragonInfo, containerId };
  },
  start,
  usage: {
    name: 'start',
    summary: 'Start the container for current project.',
    description: `Start the container assigned to the current libdragon project. Will first attempt to start an existing container if found, followed by a new container run and installation similar to the \`install\` action. Will always print out the container id to stdout on success except when verbose is set.

      Must be run in an initialized libdragon project.`,
  },
};

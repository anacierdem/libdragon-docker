const chalk = require('chalk');

const { CONTAINER_TARGET_PATH } = require('../constants');
const { spawnProcess, log, dockerExec } = require('../helpers');
const { setProjectInfoToSave } = require('../project-info');

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

module.exports = {
  name: 'start',
  fn: start,
  showStatus: false, // This will only print out the id
};

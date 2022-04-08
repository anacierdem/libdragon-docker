const chalk = require('chalk');

const { log, spawnProcess, dockerExec, dockerCompose } = require('../helpers');

const { checkContainerExists, mustHaveProject } = require('./utils');

async function checkContainerRunning(libdragonInfo) {
  return (
    await dockerCompose(libdragonInfo, ['ps', '-q', '--status=running'])
  ).trim();
}

/**
 * Create a new container
 */
const initContainer = async (libdragonInfo) => {
  let newId;
  try {
    libdragonInfo.showStatus && log('Creating new container...');
    await dockerCompose(libdragonInfo, [
      'up',
      '-d', // Detached
    ]);

    const newInfo = libdragonInfo;

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
    await dockerCompose(libdragonInfo, ['down']);
    await dockerCompose(libdragonInfo, ['rm', '-f']);
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
    await checkContainerRunning(libdragonInfo),
    '--format',
    '{{.Name}}',
  ]);

  libdragonInfo.showStatus &&
    log(
      chalk.green(`Successfully initialized docker container: ${name.trim()}`)
    );

  return newId;
};

const start = async (libdragonInfo, skipProjectCheck) => {
  !skipProjectCheck && (await mustHaveProject(libdragonInfo));
  const running = await checkContainerRunning(libdragonInfo);

  if (running) {
    log(`Container ${running} already running.`, true);
    return running;
  }

  let id = await checkContainerExists(libdragonInfo);

  if (!id) {
    log(`Container does not exist, re-initializing...`, true);
    id = await initContainer(libdragonInfo);
    return id;
  }

  log(`Starting container: ${id}`, true);
  await dockerCompose(libdragonInfo, ['up', '-d']);

  return id;
};

module.exports = {
  name: 'start',
  fn: async (libdragonInfo) => {
    const containerId = await start(libdragonInfo);
    log(containerId);
    return { ...libdragonInfo, containerId };
  },
  start,
  showStatus: false, // This will only print out the id
  usage: {
    name: 'start',
    summary: 'Start the container for current project.',
    description: `Start the container assigned to the current libdragon project. Will first attempt to start an existing container if found, followed by a new container run and installation similar to the \`install\` action. Will always print out the container id on success.

      Must be run in an initialized libdragon project.`,
  },
};

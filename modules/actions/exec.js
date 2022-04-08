const path = require('path');

const { CONTAINER_TARGET_PATH } = require('../constants');
const { log, dockerExec, toPosixPath } = require('../helpers');

const { start } = require('./start');
const { dockerHostUserParams } = require('./docker-utils');
const { installDependencies, mustHaveProject } = require('./utils');

function dockerRelativeWorkdir(libdragonInfo) {
  return (
    CONTAINER_TARGET_PATH +
    '/' +
    toPosixPath(path.relative(libdragonInfo.root, process.cwd()))
  );
}

function dockerRelativeWorkdirParams(libdragonInfo) {
  return ['--workdir', dockerRelativeWorkdir(libdragonInfo)];
}

const exec = async (libdragonInfo, commandAndParams) => {
  await mustHaveProject(libdragonInfo);

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

      // Re-install vendors on new container if one was created upon start
      // Ideally we would want the consumer to handle dependencies and rebuild
      // libdragon if necessary. Currently this saves the day with a little bit
      // extra waiting when the container is deleted.
      if (libdragonInfo.containerId !== newId) {
        await installDependencies({
          ...libdragonInfo,
          containerId: newId,
        });
      }
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
    return libdragonInfo;
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
  return libdragonInfo;
};

module.exports = {
  name: 'exec',
  fn: exec,
  forwardsRestParams: true,
  showStatus: true,
  usage: {
    name: 'exec <command>',
    summary: 'Execute given command in the current directory.',
    description: `Executes the given command in the container passing down any arguments provided. If you change your host working directory, the command will be executed in the corresponding folder in the container as well.

    This action will first try to execute the command in the container and if the container is not accessible, it will attempt a complete \`start\` cycle.

    This will properly passthrough your TTY if you have one. So by running \`libdragon exec bash\` you can start an interactive bash session with full TTY support.
    
    Must be run in an initialized libdragon project.`,
  },
};

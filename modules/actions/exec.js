const path = require('path');
const { PassThrough } = require('stream');

const { CONTAINER_TARGET_PATH } = require('../constants');
const { log, dockerExec, toPosixPath } = require('../helpers');

const { start } = require('./start');
const { dockerHostUserParams } = require('./docker-utils');
const { installDependencies } = require('./utils');

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
  log(
    `Running ${commandAndParams[0]} at ${dockerRelativeWorkdir(
      libdragonInfo
    )} with [${commandAndParams.slice(1)}]`,
    true
  );

  const stdin = new PassThrough();

  const tryCmd = (libdragonInfo, opts = {}) => {
    const enableTTY = Boolean(process.stdout.isTTY && process.stdin.isTTY);

    return (
      libdragonInfo.containerId &&
      dockerExec(
        libdragonInfo,
        [
          ...dockerRelativeWorkdirParams(libdragonInfo),
          ...dockerHostUserParams(libdragonInfo),
        ],
        commandAndParams,
        {
          userCommand: true,
          // Inherit stdin/out in tandem if we are going to disable TTY o/w the input
          // stream remains inherited by the node process while the output pipe is
          // waiting data from stdout and it behaves like we are still controlling
          // the spawned process while the terminal is actually displaying say for
          // example `less`.
          inheritStdout: enableTTY,
          inheritStdin: enableTTY,
          // spawnProcess defaults does not apply to dockerExec so we need to
          // provide these explicitly here.
          inheritStderr: true,
          ...opts,
        }
      )
    );
  };

  let started = false;
  const startOnceAndCmd = async (stdin) => {
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
      await tryCmd(
        {
          ...libdragonInfo,
          containerId: newId,
        },
        { stdin }
      );
      return newId;
    }
  };

  if (!libdragonInfo.containerId) {
    log(`Container does not exist for sure, restart`, true);
    await startOnceAndCmd();
    return libdragonInfo;
  }

  try {
    // Start collecting stdin data on an auxiliary stream such that we can pipe
    // it back to the container process if this fails the first time. Then the
    // initial failed docker process would eat up the input stream. Here, we pass
    // it to the target process eventually via startOnceAndCmd. If the input
    // stream is from a TTY, spawnProcess will already inherit it. Listening
    // to the stream here causes problems for unknown reasons.
    !process.stdin.isTTY && process.stdin.pipe(stdin);
    await tryCmd(libdragonInfo, {
      // Disable the error tty to be able to read the error message in case
      // the container is not running
      inheritStderr: false,
      // In the first run, pass the stdin to the process if it is not a TTY
      // o/w we loose a user input unnecesarily somehow.
      stdin: !process.stdin.isTTY && process.stdin,
    });
  } catch (e) {
    if (
      !e.out ||
      // TODO: is there a better way?
      !e.out.toString().includes(libdragonInfo.containerId)
    ) {
      throw e;
    }
    await startOnceAndCmd(stdin);
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

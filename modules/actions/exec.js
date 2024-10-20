const path = require('path');
const { PassThrough } = require('stream');

const { CONTAINER_TARGET_PATH } = require('../constants');
const {
  log,
  dockerExec,
  toPosixPath,
  fileExists,
  dirExists,
  CommandError,
  spawnProcess,
} = require('../helpers');

const { start } = require('./start');
const { dockerHostUserParams } = require('../docker-utils');
const { installDependencies } = require('../utils');

/**
 * @param {import('../project-info').LibdragonInfo} libdragonInfo
 */
function dockerRelativeWorkdir(libdragonInfo) {
  return (
    CONTAINER_TARGET_PATH +
    '/' +
    toPosixPath(path.relative(libdragonInfo.root, process.cwd()))
  );
}

/**
 * @param {import('../project-info').LibdragonInfo} libdragonInfo
 */
function dockerRelativeWorkdirParams(libdragonInfo) {
  return ['--workdir', dockerRelativeWorkdir(libdragonInfo)];
}

/**
 * @param {import('../project-info').LibdragonInfo} info
 */
const exec = async (info) => {
  const parameters = info.options.EXTRA_PARAMS.slice(1);
  log(
    `Running ${info.options.EXTRA_PARAMS[0]} at ${dockerRelativeWorkdir(
      info
    )} with [${parameters}]`,
    true
  );

  // Don't even bother here, we are already in a container.
  if (process.env.DOCKER_CONTAINER) {
    const enableTTY = Boolean(process.stdout.isTTY && process.stdin.isTTY);
    await spawnProcess(info.options.EXTRA_PARAMS[0], parameters, {
      userCommand: true,
      // Inherit stdin/out in tandem if we are going to disable TTY o/w the input
      // stream remains inherited by the node process while the output pipe is
      // waiting data from stdout and it behaves like we are still controlling
      // the spawned process while the terminal is actually displaying say for
      // example `less`.
      inheritStdout: enableTTY,
      inheritStdin: enableTTY,
      inheritStderr: true,
    });
    return info;
  }

  const stdin = new PassThrough();

  /** @type {string[]} */
  const paramsWithConvertedPaths = (
    await Promise.all(
      parameters.map(async (item) => {
        if (item.startsWith('-')) {
          return item;
        }
        if (
          item.includes(path.sep) &&
          ((await fileExists(item)) || (await dirExists(item)))
        ) {
          return toPosixPath(
            path.isAbsolute(item) ? path.relative(process.cwd(), item) : item
          );
        }
        return item;
      })
    )
  ).map((param) => `"${param}"`);

  /**
   *
   * @param {import('../project-info').LibdragonInfo} libdragonInfo
   * @param {import('../helpers').SpawnOptions} opts
   * @returns
   */
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
        [libdragonInfo.options.EXTRA_PARAMS[0], ...paramsWithConvertedPaths],
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
  /**
   * @param {import('fs').ReadStream=} stdin
   */
  const startOnceAndCmd = async (stdin) => {
    if (!started) {
      const newId = await start(info);
      const newInfo = {
        ...info,
        containerId: newId,
      };
      started = true;

      // Re-install vendors on new container if one was created upon start
      // Ideally we would want the consumer to handle dependencies and rebuild
      // libdragon if necessary. Currently this saves the day with a little bit
      // extra waiting when the container is deleted.
      if (info.containerId !== newId) {
        await installDependencies(newInfo);
      }
      await tryCmd(newInfo, { stdin });
      return newId;
    }
  };

  if (!info.containerId) {
    log(`Container does not exist for sure, restart`, true);
    await startOnceAndCmd();
    return info;
  }

  try {
    // Start collecting stdin data on an auxiliary stream such that we can pipe
    // it back to the container process if this fails the first time. Then the
    // initial failed docker process would eat up the input stream. Here, we pass
    // it to the target process eventually via startOnceAndCmd. If the input
    // stream is from a TTY, spawnProcess will already inherit it. Listening
    // to the stream here causes problems for unknown reasons.
    !process.stdin.isTTY && process.stdin.pipe(stdin);
    await tryCmd(info, {
      // Disable the error tty to be able to read the error message in case
      // the container is not running
      inheritStderr: false,
      // In the first run, pass the stdin to the process if it is not a TTY
      // o/w we loose a user input unnecesarily somehow.
      stdin:
        (!process.stdin.isTTY || undefined) &&
        /** @type {import('fs').ReadStream} */ (
          /** @type {unknown} */ (process.stdin)
        ),
    });
  } catch (e) {
    if (!(e instanceof CommandError)) {
      throw e;
    }
    if (
      // TODO: is there a better way?
      !e.out.toString().includes(info.containerId)
    ) {
      throw e;
    }
    await startOnceAndCmd(
      /** @type {import('fs').ReadStream} */ (/** @type {unknown} */ (stdin))
    );
  }
  return info;
};

module.exports = /** @type {const} */ ({
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
});

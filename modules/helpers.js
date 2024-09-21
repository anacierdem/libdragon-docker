const path = require('path');
const fs = require('fs/promises');
const fsClassic = require('fs');
const chalk = require('chalk').stderr;
const { spawn } = require('child_process');

const { globals } = require('./globals');
const { NO_PROJECT_ACTIONS } = require('./constants');

/**
 * A structure to keep additional error information
 * @typedef {Object} ErrorState
 * @property {number} code
 * @property {string} out
 * @property {boolean} userCommand
 */

/**
 * An error caused by a command exiting with a non-zero exit code
 * @class
 */
class CommandError extends Error {
  /**
   * @param {string} message Error message to report
   * @param {ErrorState} errorState
   */
  constructor(message, { code, out, userCommand }) {
    super(message);

    /**
     * Exit code
     * @type {number}
     * @public
     */
    this.code = code;

    /**
     * Error output as a single concatanated string
     * @type {string}
     * @public
     */
    this.out = out;

    /**
     * true when the error caused by a command explicitly run by the end user
     * @type {boolean}
     * @public
     */
    this.userCommand = userCommand;
  }
}

/**
 * An error caused by the user providing an unexpected input
 * @class
 */
class ParameterError extends Error {
  /**
   * @param {string} message Error message to report
   * @param {string} actionName
   */
  constructor(message, actionName) {
    super(message);

    /**
     * true when the error caused by a command explicitly run by the end user
     * @type {string}
     * @public
     */
    this.actionName = actionName;
  }
}

/**
 * Something was not as expected to continue the operation
 * @class
 */
class ValidationError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
  }
}

/**
 * @param {string} path
 */
async function fileExists(path) {
  return fs
    .stat(path)
    .then((s) => s.isFile())
    .catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return false;
    });
}

/**
 * @param {string} path
 */
async function dirExists(path) {
  return fs
    .stat(path)
    .then((s) => s.isDirectory())
    .catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return false;
    });
}

/**
 * @typedef {{
 *  userCommand?: boolean,
 *  inheritStdin?: boolean,
 *  inheritStdout?: boolean,
 *  inheritStderr?: boolean,
 *  spawnOptions?: import('child_process').SpawnOptions,
 *  stdin?: fsClassic.ReadStream,
 * }} SpawnOptions
 */

// A simple Promise wrapper for child_process.spawn. Return the err/out streams
// from the process by default. Specify inheritStdout / inheritStderr to disable
// this and inherit the parent process's stream, passing through the TTY if any.
/**
 *
 * @param {string} cmd
 * @param {string[]} params
 * @param {SpawnOptions} options
 * @returns {Promise<string>}
 */
function spawnProcess(
  cmd,
  params = [],
  {
    // Used to decorate the potential CommandError with a prop such that we can
    // report this error back to the user.
    userCommand = false,
    // This is the stream where the process will receive its input.
    stdin,
    // If this is true, the related stream is inherited from the parent process
    // and we cannot read them anymore. So if you need to read a stream, you
    // should disable it. When disabled, the relevant stream cannot be a tty
    // anymore. By default, we expect the caller to read err/out.
    inheritStdin = true,
    inheritStdout = false,
    inheritStderr = false,
    // Passthrough to spawn
    spawnOptions = {},
  } = {
    userCommand: false,
    inheritStdin: true,
    inheritStdout: false,
    inheritStderr: false,
    spawnOptions: {},
  }
) {
  assert(
    cmd !== 'docker' || !process.env.DOCKER_CONTAINER,
    new Error('Trying to invoke docker inside a container.')
  );
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const stdout = [];

    /** @type {Buffer[]} */
    const stderr = [];

    log(chalk.grey(`Spawning: ${cmd} ${params.join(' ')}`), true);

    const enableInTTY = Boolean(process.stdin.isTTY) && inheritStdin;
    const enableOutTTY = Boolean(process.stdout.isTTY) && inheritStdout;
    const enableErrorTTY = Boolean(process.stderr.isTTY) && inheritStderr;

    const command = spawn(cmd, params, {
      stdio: [
        enableInTTY ? 'inherit' : 'pipe',
        enableOutTTY ? 'inherit' : 'pipe',
        enableErrorTTY ? 'inherit' : 'pipe',
      ],
      ...spawnOptions,
    });

    // See a very old related issue: https://github.com/nodejs/node/issues/947
    // When the stream is not fully consumed by the pipe target and it exits,
    // an EPIPE or EOF is thrown. We don't care about those.
    /**
     * @param {Error & {code: string}} err
     */
    const eatEpipe = (err) => {
      if (err.code !== 'EPIPE' && err.code !== 'EOF') {
        throw err;
      }
      // No need to listen for close anymore
      command.off('close', closeHandler);

      // It was not fully consumed, just resolve into an empty string
      // No one should be using this anyways. Ideally we could clean a few
      // last bytes from the buffers to create a correct utf-8 string.
      resolve('');
    };

    if (!enableInTTY && stdin && command.stdin) {
      stdin.pipe(command.stdin);
    }

    if (!enableOutTTY && (globals.verbose || userCommand) && command.stdout) {
      command.stdout.pipe(process.stdout);
      process.stdout.once('error', eatEpipe);
    }

    if (!inheritStdout && command.stdout) {
      command.stdout.on('data', function (data) {
        stdout.push(Buffer.from(data));
      });
    }

    if (!enableErrorTTY && (globals.verbose || userCommand) && command.stderr) {
      command.stderr.pipe(process.stderr);
    }

    if (!inheritStderr && command.stderr) {
      command.stderr.on('data', function (data) {
        stderr.push(Buffer.from(data));
      });
    }

    /**
     * @param {Error} err
     */
    const errorHandler = (err) => {
      command.off('close', closeHandler);
      reject(err);
    };

    /**
     * @param {number} code
     */
    const closeHandler = function (code) {
      // The stream was fully consumed, if there is this an additional error on
      // stdout, it must be a legitimate error
      process.stdout.off('error', eatEpipe);
      command.off('error', errorHandler);
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString());
      } else {
        const err = new CommandError(
          `Command ${cmd} ${params.join(' ')} exited with code ${code}.`,
          {
            code,
            out: Buffer.concat(stderr).toString(),
            userCommand,
          }
        );
        reject(err);
      }
    };

    command.once('error', errorHandler);
    command.once('close', closeHandler);
  });
}

/**
 * @typedef {{
 * (libdragonInfo: import('./project-info').LibdragonInfo, dockerParams: string[], cmdWithParams: string[], options?: SpawnOptions): Promise<string>;
 * (libdragonInfo: import('./project-info').LibdragonInfo, cmdWithParams: string[], options?: SpawnOptions, unused?: unknown): Promise<string>;
 * }} DockerExec
 */
const dockerExec = /** @type {DockerExec} */ (
  function (
    libdragonInfo,
    dockerParams,
    cmdWithParams,
    /** @type {SpawnOptions | undefined} */
    options
  ) {
    // TODO: assert for invalid args
    const haveDockerParams =
      Array.isArray(dockerParams) && Array.isArray(cmdWithParams);

    if (!haveDockerParams) {
      options = /** @type {SpawnOptions} */ (cmdWithParams);
    }

    const finalCmdWithParams = haveDockerParams ? cmdWithParams : dockerParams;
    const finalDockerParams = haveDockerParams ? dockerParams : [];

    assert(
      finalDockerParams.findIndex(
        (val) => val === '--workdir=' || val === '-w='
      ) === -1,
      new Error('Do not use `=` syntax when setting working dir')
    );

    // Convert docker execs into regular commands in the correct cwd
    if (process.env.DOCKER_CONTAINER) {
      const workDirIndex = finalDockerParams.findIndex(
        (val) => val === '--workdir' || val === '-w'
      );
      const workDir =
        workDirIndex >= 0 ? finalDockerParams[workDirIndex + 1] : undefined;
      return spawnProcess(finalCmdWithParams[0], finalCmdWithParams.slice(1), {
        ...options,
        spawnOptions: { cwd: workDir, ...options?.spawnOptions },
      });
    }

    assert(
      !!libdragonInfo.containerId,
      new Error('Trying to invoke dockerExec without a containerId.')
    );

    /** @type string[] */
    const additionalParams = [];

    // Docker TTY wants in & out streams both to be a TTY
    // If no options are provided, disable TTY as spawnProcess defaults to no
    // inherit as well.
    const enableTTY = options
      ? options.inheritStdout && options.inheritStdin
      : false;
    const ttyEnabled = enableTTY && process.stdout.isTTY && process.stdin.isTTY;

    if (ttyEnabled) {
      additionalParams.push('-t');
    }

    // Always enable stdin, also see; https://github.com/anacierdem/libdragon-docker/issues/45
    // Currently we run all exec commands in stdin mode even if the actual process
    // does not need any input. This will eat any user input by default.
    additionalParams.push('-i');

    return spawnProcess(
      'docker',
      [
        'exec',
        ...finalDockerParams,
        ...additionalParams,
        libdragonInfo.containerId,
        ...finalCmdWithParams,
      ],
      options
    );
  }
);

/**
 * Recursively copies directories and files
 * @param {string} src
 * @param {string} dst
 */
async function copyDirContents(src, dst) {
  log(`Copying from ${src} to ${dst}`, true);

  const dstStat = await fs.stat(dst).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    return null;
  });

  if (dstStat && !dstStat.isDirectory()) {
    log(`${dst} is not a directory, skipping.`);
    return;
  }

  if (!dstStat) {
    log(`Creating a directory at ${dst}.`, true);
    await fs.mkdir(dst);
  }

  const files = await fs.readdir(src);
  return Promise.all(
    files.map(async (name) => {
      const source = path.join(src, name);
      const dest = path.join(dst, name);
      // promise version does not work on snapshot filesystem
      // Also see https://github.com/vercel/pkg/issues/1561
      const stats = await new Promise((res, rej) =>
        fsClassic.stat(source, (err, stats) => {
          if (err) return rej(err);
          res(stats);
        })
      );
      if (stats.isDirectory()) {
        await copyDirContents(source, dest);
      } else if (stats.isFile()) {
        const content = await fs.readFile(source);
        try {
          log(`Writing to ${dest}`, true);
          await fs.writeFile(dest, content, {
            flag: 'wx',
          });
        } catch {
          log(`${dest} already exists, skipping.`);
          return;
        }
      }
    })
  );
}

/**
 * @param {string} p
 */
function toPosixPath(p) {
  return p.replace(new RegExp('\\' + path.sep, 'g'), path.posix.sep);
}

/**
 * @param {string} p
 */
function toNativePath(p) {
  return p.replace(new RegExp('\\' + path.posix.sep, 'g'), path.sep);
}

/**
 * @param {any} condition
 * @param {Error} error
 * @returns {asserts condition}
 */
function assert(condition, error) {
  if (!condition) {
    error.message = `[ASSERTION FAILED] ${error.message}`;
    throw error;
  }
}

/**
 * @param {string} text
 */
function print(text) {
  // eslint-disable-next-line no-console
  console.log(text);
  return;
}

/**
 * @param {string} text
 * @param {boolean} verboseOnly
 */
function log(text, verboseOnly = false) {
  if (!verboseOnly) {
    // eslint-disable-next-line no-console
    console.error(text);
    return;
  }
  if (globals.verbose) {
    // eslint-disable-next-line no-console
    console.error(chalk.gray(text));
    return;
  }
}

/**
 * @param {import('./project-info').CLIInfo | import('./project-info').LibdragonInfo} info
 * @returns {info is import('./project-info').LibdragonInfo}
 */
function isProjectAction(info) {
  return !NO_PROJECT_ACTIONS.includes(
    /** @type {import('./project-info').ActionsNoProject} */ (
      info.options.CURRENT_ACTION.name
    )
  );
}

module.exports = {
  spawnProcess,
  toPosixPath,
  toNativePath,
  print,
  log,
  dockerExec,
  assert,
  fileExists,
  dirExists,
  copyDirContents,
  CommandError,
  ParameterError,
  ValidationError,
  isProjectAction,
};

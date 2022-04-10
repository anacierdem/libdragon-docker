const path = require('path');
const fs = require('fs/promises');
const fsClassic = require('fs');
const chalk = require('chalk').stderr;
const { spawn } = require('child_process');

const { globals } = require('./globals');

// An error caused by a command explicitly run by the user
class CommandError extends Error {
  constructor(message, { code, out, userCommand }) {
    super(message);
    this.code = code;
    this.out = out;
    this.userCommand = userCommand;
  }
}

// The user provided an unexpected input
class ParameterError extends Error {
  constructor(message) {
    super(message);
  }
}

// Something was not as expected to continue the operation
class ValidationError extends Error {
  constructor(message) {
    super(message);
  }
}

async function fileExists(path) {
  return fs
    .stat(path)
    .then((s) => s.isFile())
    .catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return false;
    });
}

async function dirExists(path) {
  return fs
    .stat(path)
    .then((s) => s.isDirectory())
    .catch((e) => {
      if (e.code !== 'ENOENT') throw e;
      return false;
    });
}

// A simple Promise wrapper for child_process.spawn. If interactive is true,
// stdout becomes a tty when available and we cannot read the stdout from the
// command anymore. If interactive is "full", the error stream is also piped to
// the main process as TTY, so it is not readable anymore as well. For the
// commands using stderr as TTY it should be set to "full"
function spawnProcess(
  cmd,
  params = [],
  {
    userCommand = false,
    interactive = false,
    readStdout,
    spawnOptions = {},
    pipeOutputs,
  } = {
    userCommand: false,
    interactive: false,
    spawnOptions: {},
  }
) {
  // We won't need to collect the data if it is a user command in general
  readStdout =
    typeof readStdout === 'undefined'
      ? !userCommand && !interactive
      : readStdout;

  // By default we want the outputs to get piped if it is user initiated
  pipeOutputs = typeof pipeOutputs === 'undefined' ? userCommand : pipeOutputs;

  assert(
    !interactive || !readStdout,
    new Error('Cannot enable TTY and read data at the same time for now.')
  );
  return new Promise((resolve, reject) => {
    let stdout = [];
    let stderr = [];

    log(chalk.grey(`Spawning: ${cmd} ${params.join(' ')}`), true);

    const isTTY =
      process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY;
    const enableTTY = isTTY && !!interactive;
    const enableErrorTTY = isTTY && interactive === 'full';

    const command = spawn(cmd, params, {
      // We should redirect streams together for the TTY to work
      // properly if they are all used as TTY
      stdio: [
        enableTTY ? 'inherit' : 'pipe',
        enableTTY ? 'inherit' : 'pipe',
        enableErrorTTY ? 'inherit' : 'pipe',
      ],
      ...spawnOptions,
    });

    if (!enableTTY && (globals.verbose || pipeOutputs)) {
      command.stdout.pipe(process.stdout);
    }

    if (!enableErrorTTY && (globals.verbose || pipeOutputs)) {
      command.stderr.pipe(process.stderr);
    }

    if (!enableTTY && readStdout) {
      command.stdout.on('data', function (data) {
        stdout.push(Buffer.from(data));
      });
    }

    if (!enableErrorTTY) {
      command.stderr.on('data', function (data) {
        stderr.push(Buffer.from(data));
      });
    }

    const errorHandler = (err) => {
      command.off('close', closeHandler);
      reject(err);
    };

    const closeHandler = function (code) {
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

function dockerExec(libdragonInfo, dockerParams, cmdWithParams, options) {
  // TODO: assert for invalid args
  const haveDockerParams =
    Array.isArray(dockerParams) && Array.isArray(cmdWithParams);
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  // interactive and TTY?
  const additionalParams =
    isTTY &&
    (haveDockerParams ? options?.interactive : cmdWithParams?.interactive)
      ? ['-it']
      : [];
  return spawnProcess(
    'docker',
    [
      'exec',
      ...(haveDockerParams
        ? [...dockerParams, ...additionalParams]
        : additionalParams),
      libdragonInfo.containerId,
      ...(haveDockerParams ? cmdWithParams : dockerParams),
    ],
    haveDockerParams ? options : cmdWithParams
  );
}

/**
 * Recursively copies directories and files
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
        } catch (e) {
          log(`${dest} already exists, skipping.`);
          return;
        }
      }
    })
  );
}

function toPosixPath(p) {
  return p.replace(new RegExp('\\' + path.sep, 'g'), path.posix.sep);
}

function toNativePath(p) {
  return p.replace(new RegExp('\\' + path.posix.sep, 'g'), path.sep);
}

function assert(condition, error) {
  if (!condition) {
    error.message = `[ASSERTION FAILED] ${error.message}`;
    throw error;
  }
}

function print(text) {
  // eslint-disable-next-line no-console
  console.log(text);
  return;
}

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
};

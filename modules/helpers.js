const path = require('path');
const fs = require('fs');
const os = require('os');
const chalk = require('chalk');
const { spawn } = require('child_process');

const {
  CACHED_CONTAINER_FILE,
  LIBDRAGON_PROJECT_MANIFEST,
  IMAGE_FILE,
  DOCKER_HUB_IMAGE,
  CONTAINER_TARGET_PATH,
} = require('./constants');

const globals = {
  verbose: false,
};

class CommandError extends Error {
  constructor(message, { code, out, userCommand }) {
    super(message);
    this.code = code;
    this.out = out;
    this.userCommand = userCommand;
  }
}

// A simple Promise wrapper for child_process.spawn. If interactive is true,
// stdout becomes a tty when available and we cannot read the stdout from the
// command anymore. If interactive is "full", the error stream is also piped to
// the main process as TTY, so it is not readable anymore as well. For the
// commands using stderr as TTY it should be set to "full"
function spawnProcess(cmd, params = [], userCommand, interactive = false) {
  return new Promise((resolve, reject) => {
    let stdout = [];
    let stderr = [];

    if (globals.verbose) {
      log(chalk.grey(`Spawning: ${cmd} ${params.join(' ')}`), true);
    }

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
    });

    if (!enableTTY && (globals.verbose || userCommand)) {
      command.stdout.pipe(process.stdout);
    }

    if (!enableErrorTTY && (globals.verbose || userCommand)) {
      command.stderr.pipe(process.stderr);
    }

    // We shouldn't need to collect the data if it is a user command.
    if (!enableTTY && !userCommand) {
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

function dockerExec(
  libdragonInfo,
  dockerParams,
  cmdWithParams,
  userCommand,
  interactive
) {
  // TODO: assert for invalid args
  const haveDockerParams =
    Array.isArray(dockerParams) && Array.isArray(cmdWithParams);
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  // interactive and TTY?
  const additionalParams =
    isTTY && (haveDockerParams ? interactive : userCommand) ? ['-it'] : [];
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
    haveDockerParams ? userCommand : cmdWithParams,
    haveDockerParams ? interactive : userCommand
  );
}

/**
 * Invokes host git with provided params. If host does not have git, falls back
 * to the docker git, with the nix user set to the user running libdragon.
 */
async function runGitMaybeHost(libdragonInfo, params, interactive = 'full') {
  try {
    return await spawnProcess(
      'git',
      params,
      false,
      // Windows git is breaking the TTY somehow - disable interactive for now
      // We are not able to display progress for the initial clone b/c of this
      /^win/.test(process.platform) ? false : interactive
    );
  } catch (e) {
    if (!(e instanceof CommandError)) {
      return await dockerExec(
        libdragonInfo,
        // Use the host user when initializing git as we will need access
        [...dockerHostUserParams(libdragonInfo)],
        ['git', ...params],
        false,
        interactive
      );
    }
    throw e;
  }
}

function runNPM(params) {
  return spawnProcess(
    /^win/.test(process.platform) ? 'npm.cmd' : 'npm',
    params
  );
}

function findLibdragonRoot(start = '.') {
  const manifest = path.join(start, LIBDRAGON_PROJECT_MANIFEST);
  if (fs.existsSync(manifest) && fs.statSync(manifest).isDirectory()) {
    return path.resolve(start);
  } else {
    const parent = path.resolve(start, '..');
    if (parent !== path.resolve(start)) {
      return findLibdragonRoot(parent);
    } else {
      return;
    }
  }
}

async function findNPMRoot() {
  try {
    const root = path.resolve((await runNPM(['root'])).trim(), '..');
    // Only report if package.json really exists. npm fallbacks to cwd
    if (fs.existsSync(path.join(root, 'package.json'))) {
      return root;
    }
  } catch {
    // User does not have and does not care about NPM if it didn't work
    return undefined;
  }
}

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

function dockerHostUserParams(libdragonInfo) {
  const { uid, gid } = libdragonInfo.userInfo;
  return ['-u', `${uid >= 0 ? uid : ''}:${gid >= 0 ? gid : ''}`];
}

async function findGitRoot() {
  try {
    return (await spawnProcess('git', ['rev-parse', '--show-toplevel'])).trim();
  } catch {
    // No need to do anything if the user does not have git
    return undefined;
  }
}

async function findContainerId(libdragonInfo) {
  const idFile = path.join(libdragonInfo.root, '.git', CACHED_CONTAINER_FILE);
  if (fs.existsSync(idFile)) {
    const id = fs.readFileSync(idFile, { encoding: 'utf8' }).trim();
    log(`Read containerId: ${id}`, true);
    return id;
  }

  const candidates = (
    await spawnProcess('docker', [
      'container',
      'ls',
      '-a',
      '--format',
      '{{.}}{{.ID}}',
      '-f',
      'volume=' + CONTAINER_TARGET_PATH,
    ])
  )
    .split('\n')
    .filter((s) => s.includes(`${libdragonInfo.root} `));

  if (candidates.length > 0) {
    const str = candidates[0];
    const shortId = str.slice(-12);
    const idIndex = str.indexOf(shortId);
    const longId = str.slice(idIndex, idIndex + 64);
    if (longId.length === 64) {
      tryCacheContainerId({ ...libdragonInfo, containerId: longId });
      return longId;
    }
  }
}

async function checkContainerAndClean(libdragonInfo) {
  const id =
    libdragonInfo.containerId &&
    (
      await spawnProcess('docker', [
        'container',
        'ls',
        '-qa',
        '-f id=' + libdragonInfo.containerId,
      ])
    ).trim();

  // Container does not exist, clean the id up
  if (!id) {
    const containerIdFile = path.join(
      libdragonInfo.root,
      '.git',
      CACHED_CONTAINER_FILE
    );
    if (fs.existsSync(containerIdFile)) {
      fs.rmSync(containerIdFile);
    }
  }
  return id ? libdragonInfo.containerId : undefined;
}

async function checkContainerRunning(containerId) {
  const running = (
    await spawnProcess('docker', [
      'container',
      'ls',
      '-q',
      '-f id=' + containerId,
    ])
  ).trim();
  return running ? containerId : undefined;
}

async function readProjectInfo() {
  const info = {
    root:
      (await findLibdragonRoot()) ??
      (await findNPMRoot()) ??
      (await findGitRoot()),
    userInfo: os.userInfo(),
  };

  if (!info.root) {
    log('Could not find project root, set as cwd.', true);
    info.root = process.cwd();
  }

  log(`Project root: ${info.root}`, true);

  const imageFile = path.join(
    info.root,
    LIBDRAGON_PROJECT_MANIFEST,
    IMAGE_FILE
  );

  // flag has the highest priority followed by the one read from the file
  // and then if there is any matching container, name is read from it. As last
  // option fallback to default value.
  if (fs.existsSync(imageFile) && !fs.statSync(imageFile).isDirectory()) {
    info.imageName = fs.readFileSync(imageFile, { encoding: 'utf8' }).trim();
  }

  info.containerId = await findContainerId(info);
  log(`Active container id: ${info.containerId}`, true);

  // If still have the container, read the image name from it
  if (!info.imageName && (await checkContainerAndClean(info))) {
    info.imageName = (
      await spawnProcess('docker', [
        'container',
        'inspect',
        info.containerId,
        '--format',
        '{{.Config.Image}}',
      ])
    ).trim();

    // Cache the image name
    await updateImageName(info);
  }

  info.imageName = info.imageName ?? DOCKER_HUB_IMAGE;
  log(`Active image name: ${info.imageName}`, true);
  return info;
}

async function updateImageName(libdragonInfo) {
  if (!libdragonInfo.imageName) return;
  const manifestPath = path.join(
    libdragonInfo.root,
    LIBDRAGON_PROJECT_MANIFEST
  );
  await createManifestIfNotExist(libdragonInfo);
  fs.writeFileSync(
    path.join(manifestPath, IMAGE_FILE),
    libdragonInfo.imageName
  );
  log(`Image name updated: ${libdragonInfo.imageName}`, true);
}

/**
 * Creates the manifest folder if it does not exist. Will return true if
 * created, false otherwise.
 */
async function createManifestIfNotExist(libdragonInfo) {
  const manifestPath = path.join(
    libdragonInfo.root,
    LIBDRAGON_PROJECT_MANIFEST
  );
  if (fs.existsSync(manifestPath) && !fs.statSync(manifestPath).isDirectory()) {
    throw new Error(
      'There is already a `.libdragon` file and it is not a directory.'
    );
  }

  if (!fs.existsSync(manifestPath)) {
    log(
      `Creating libdragon project configuration at \`${libdragonInfo.root}\`.`
    );
    fs.mkdirSync(manifestPath);
  }
}

function tryCacheContainerId(libdragonInfo) {
  const gitFolder = path.join(libdragonInfo.root, '.git');
  if (fs.existsSync(gitFolder) && fs.statSync(gitFolder).isDirectory()) {
    fs.writeFileSync(
      path.join(libdragonInfo.root, '.git', CACHED_CONTAINER_FILE),
      libdragonInfo.containerId
    );
  }
}

function toPosixPath(p) {
  return p.replace(new RegExp('\\' + path.sep), path.posix.sep);
}

function log(text, verboseOnly = false) {
  if (!verboseOnly) {
    // eslint-disable-next-line no-console
    console.log(text);
    return;
  }
  if (globals.verbose) {
    // eslint-disable-next-line no-console
    console.log(chalk.gray(text));
    return;
  }
}

module.exports = {
  spawnProcess,
  readProjectInfo,
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
  CommandError,
  globals,
};

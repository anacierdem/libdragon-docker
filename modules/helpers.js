const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { spawn } = require('child_process');

const {
  CACHED_CONTAINER_FILE,
  LIBDRAGON_PROJECT_MANIFEST,
  IMAGE_FILE,
  DOCKER_HUB_IMAGE,
  PROJECT_NAME,
} = require('./constants');

const globals = {
  verbose: false,
};

// A simple Promise wrapper for child_process.spawn
function spawnProcess(cmd, params = [], showOutput = globals.verbose) {
  return new Promise((resolve, reject) => {
    let stdout = [];
    let stderr = [];

    if (globals.verbose) {
      log(chalk.grey(`Spawning: ${cmd} ${params.join(' ')}`), true);
    }

    const command = spawn(cmd, params);

    command.stdout.on('data', function (data) {
      if (showOutput) {
        process.stdout.write(data);
      }
      stdout.push(Buffer.from(data));
    });

    command.stderr.on('data', function (data) {
      if (showOutput) {
        process.stderr.write(data);
      }
      stderr.push(Buffer.from(data));
    });

    const errorHandler = (err) => {
      command.off('close', closeHandler);
      reject(err);
    };

    const closeHandler = function (code) {
      command.off('error', errorHandler);
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString());
      } else {
        const err = new Error(
          `Command ${cmd} ${params.join(' ')} exited with code ${code}.`
        );
        // TODO: Use an extended Error here
        err.code = code;
        err.out = Buffer.concat(stderr);
        err.showOutput = showOutput;
        reject(err);
      }
    };

    command.on('error', errorHandler);
    command.once('close', closeHandler);
  });
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
  if (PROJECT_NAME) {
    return path.resolve((await runNPM(['root'])).trim(), '..');
  }
}

async function findGitRoot() {
  try {
    return (await spawnProcess('git', ['rev-parse', '--show-toplevel'])).trim();
  } catch {
    // No need to do anything if the user does not have git
    return undefined;
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
  return running;
}

async function readProjectInfo() {
  const info = {};
  info.root =
    (await findLibdragonRoot()) ??
    (await findNPMRoot()) ??
    (await findGitRoot());

  if (!info.root) {
    log('Could not find project root, set as cwd.', true);
    info.root = process.cwd();
    return info;
  }

  log(`Project root: ${info.root}`, true);

  const idFile = path.join(info.root, '.git', CACHED_CONTAINER_FILE);
  if (fs.existsSync(idFile)) {
    const id = fs.readFileSync(idFile, { encoding: 'utf8' }).trim();
    log(`Read containerId: ${id}`, true);
    info.containerId = id;
  }

  info.imageName = DOCKER_HUB_IMAGE;

  const imageFile = path.join(
    info.root,
    LIBDRAGON_PROJECT_MANIFEST,
    IMAGE_FILE
  );

  if (fs.existsSync(imageFile) && !fs.statSync(imageFile).isDirectory()) {
    info.imageName = fs.readFileSync(imageFile, { encoding: 'utf8' }).trim();
  }

  return info;
}

function withProject(fn) {
  return function (...args) {
    if (!args[0].root) {
      console.error(
        'No libdragon project found. You can initialize one here with `libdragon init`.'
      );
      process.exit(1);
    }
    return fn(...args);
  };
}

async function updateImageName(libdragonInfo) {
  const manifestPath = path.join(
    libdragonInfo.root,
    LIBDRAGON_PROJECT_MANIFEST
  );

  // flag has the highest priority followed by the one read from the file
  // and then if there is any matching container, name is read from it
  const imageName =
    libdragonInfo.options.DOCKER_IMAGE ??
    libdragonInfo.imageName ??
    (await spawnProcess('docker', [
      'container',
      'inspect',
      libdragonInfo.containerId,
      '--format',
      '{{.Config.Image}}',
    ]));

  fs.writeFileSync(path.resolve(manifestPath, IMAGE_FILE), imageName);
  log(`Image name updated: ${imageName}`, true);
  return imageName;
}

async function createManifestIfNotExist(libdragonInfo) {
  const manifestPath = path.join(
    libdragonInfo.root,
    LIBDRAGON_PROJECT_MANIFEST
  );
  if (fs.existsSync(manifestPath) && !fs.statSync(manifestPath).isDirectory()) {
    console.error(
      'There is already a `.libdragon` file and it is not a directory.'
    );
    process.exit(1);
  }

  if (!fs.existsSync(manifestPath)) {
    log(
      `Creating libdragon project configuration at \`${libdragonInfo.root}\`.`
    );
    fs.mkdirSync(manifestPath);
  }
}

function toPosixPath(p) {
  return p.replace(new RegExp('\\' + path.sep), path.posix.sep);
}

function log(text, verboseOnly = false) {
  if (!verboseOnly) {
    console.log(text);
    return;
  }
  if (globals.verbose) {
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
  withProject,
  updateImageName,
  createManifestIfNotExist,
  runNPM,
  findNPMRoot,
  log,
  globals,
};

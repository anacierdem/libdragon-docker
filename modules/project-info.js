const path = require('path');
const os = require('os');
const fs = require('fs/promises');

const {
  checkContainerAndClean,
  tryCacheContainerId,
  runGitMaybeHost,
} = require('./actions/utils');

const { findNPMRoot } = require('./actions/npm-utils');

const {
  LIBDRAGON_PROJECT_MANIFEST,
  CONFIG_FILE,
  DOCKER_HUB_IMAGE,
  DEFAULT_STRATEGY,
  IMAGE_FILE,
  LIBDRAGON_SUBMODULE,
  CACHED_CONTAINER_FILE,
  CONTAINER_TARGET_PATH,
} = require('./constants');

const {
  fileExists,
  log,
  spawnProcess,
  toPosixPath,
  assert,
  ParameterError,
} = require('./helpers');

const initAction = require('./actions/init');

async function findContainerId(libdragonInfo) {
  const idFile = path.join(libdragonInfo.root, '.git', CACHED_CONTAINER_FILE);
  if (await fileExists(idFile)) {
    const id = (await fs.readFile(idFile, { encoding: 'utf8' })).trim();
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
    // docker seem to save paths with posix separators but make sure we look for
    // both, just in case
    .filter(
      (s) =>
        s.includes(`${toPosixPath(libdragonInfo.root)} `) ||
        s.includes(`${libdragonInfo.root} `)
    );

  if (candidates.length > 0) {
    const str = candidates[0];
    const shortId = str.slice(-12);
    const idIndex = str.indexOf(shortId);
    const longId = str.slice(idIndex, idIndex + 64);
    if (longId.length === 64) {
      // If there is managed vendoring, make sure we have a git repo. This shouldn't
      // happen but if the user somehow deleted the .git folder (we don't have
      // the container id file at this point) we can recover the project.
      if (libdragonInfo.vendorStrategy !== 'manual') {
        await runGitMaybeHost(libdragonInfo, ['init']);
      }
      await tryCacheContainerId({ ...libdragonInfo, containerId: longId });
      return longId;
    }
  }
}

async function findLibdragonRoot(start = '.') {
  const manifest = path.join(start, LIBDRAGON_PROJECT_MANIFEST, CONFIG_FILE);
  if (await fileExists(manifest)) {
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

async function findGitRoot() {
  try {
    return (await spawnProcess('git', ['rev-parse', '--show-toplevel'])).trim();
  } catch {
    // No need to do anything if the user does not have git
    return undefined;
  }
}

async function readProjectInfo(currentAction) {
  // No need to do anything here if the action does not depend on the project
  // The only exception is the init action, which does not need an existing
  // project but readProjectInfo must always run to analyze the situation
  if (currentAction.mustHaveProject === false && currentAction !== initAction) {
    return;
  }

  const projectRoot = await findLibdragonRoot();

  if (!projectRoot && currentAction !== initAction) {
    throw new ParameterError(
      'This is not a libdragon project. Initialize with `libdragon init` first.'
    );
  }

  let info = {
    root: projectRoot ?? (await findNPMRoot()) ?? (await findGitRoot()),
    userInfo: os.userInfo(),

    // Use this to discriminate if there is a project when the command is run
    // Only used for the init action ATM, and it is not ideal to have this here
    haveProjectConfig: !!projectRoot,

    // Set the defaults immediately, these should be present at all times even
    // if we are migrating from the old config because they did not exist before
    imageName: DOCKER_HUB_IMAGE,
    vendorDirectory: toPosixPath(path.join('.', LIBDRAGON_SUBMODULE)),
    vendorStrategy: DEFAULT_STRATEGY,
  };

  if (!info.root) {
    log('Could not find project root, set as cwd.', true);
    info.root = process.cwd();
  }

  log(`Project root: ${info.root}`, true);

  const configFile = path.join(
    info.root,
    LIBDRAGON_PROJECT_MANIFEST,
    CONFIG_FILE
  );

  if (await fileExists(configFile)) {
    info = {
      ...info,
      ...JSON.parse(await fs.readFile(configFile, { encoding: 'utf8' })),
    };
  } else {
    // Cleanup old files and migrate to the new config file
    const imageFile = path.join(
      info.root,
      LIBDRAGON_PROJECT_MANIFEST,
      IMAGE_FILE
    );
    if (await fileExists(imageFile)) {
      info.imageName = (
        await fs.readFile(imageFile, { encoding: 'utf8' })
      ).trim();
      // Immediately update the config as this is the first migration
      await Promise.all([writeProjectInfo(info), fs.rm(imageFile)]);
    }
  }

  info.containerId = await findContainerId(info);
  log(`Active container id: ${info.containerId}`, true);

  // For imageName, flag has the highest priority followed by the one read from
  // the file and then if there is any matching container, name is read from it.
  // As last option fallback to default value.

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
  }

  log(`Active image name: ${info.imageName}`, true);
  log(`Active vendor directory: ${info.vendorDirectory}`, true);
  log(`Active vendor strategy: ${info.vendorStrategy}`, true);

  return info;
}

/**
 * @param info This is only the base info without options
 * fn and command line options
 */
async function writeProjectInfo(info) {
  // Do not log anything here as it may litter the output being always run on exit
  if (!info) return;

  const projectPath = path.join(info.root, LIBDRAGON_PROJECT_MANIFEST);

  const pathExists = await fs.stat(projectPath).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    return false;
  });

  if (!pathExists) {
    log(`Creating libdragon project configuration at \`${info.root}\`.`, true);
    await fs.mkdir(projectPath);
  }

  assert(
    toPosixPath(info.vendorDirectory) === info.vendorDirectory,
    new Error('vendorDirectory should always be in posix format')
  );

  await fs.writeFile(
    path.join(projectPath, CONFIG_FILE),
    JSON.stringify(
      {
        imageName: info.imageName,
        vendorDirectory: info.vendorDirectory,
        vendorStrategy: info.vendorStrategy,
      },
      null,
      '  '
    )
  );
  log(`Configuration file updated`, true);
}

module.exports = { readProjectInfo, writeProjectInfo };

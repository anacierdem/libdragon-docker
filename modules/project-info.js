const path = require('path');
const os = require('os');
const fs = require('fs/promises');

const { checkContainerExists } = require('./actions/utils');

const { findNPMRoot } = require('./actions/npm-utils');

const {
  LIBDRAGON_PROJECT_MANIFEST,
  CONFIG_FILE,
  DOCKER_HUB_IMAGE,
  DEFAULT_STRATEGY,
  IMAGE_FILE,
  LIBDRAGON_SUBMODULE,
  CACHED_CONTAINER_FILE,
  LIBDRAGON_COMPOSE_FILE,
  CONTAINER_TARGET_PATH,
} = require('./constants');

const {
  fileExists,
  log,
  spawnProcess,
  toPosixPath,
  assert,
} = require('./helpers');

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

async function readProjectInfo() {
  const projectRoot = await findLibdragonRoot();

  let info = {
    root: projectRoot ?? (await findNPMRoot()) ?? (await findGitRoot()),
    userInfo: os.userInfo(),

    // Use this to discriminate if there is a project when the command is run
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

  // New migration
  const containerIdFile = path.join(info.root, '.git', CACHED_CONTAINER_FILE);
  if (await fileExists(containerIdFile)) {
    const containerId = (
      await fs.readFile(containerIdFile, { encoding: 'utf8' })
    ).trim();

    if (containerId) {
      log(`Removing container id: ${containerId}`, true);
      await spawnProcess('docker', ['container', 'rm', containerId, '--force']);
    }
    await fs.rm(containerIdFile);
  }

  const composeFile = path.join(
    info.root,
    LIBDRAGON_PROJECT_MANIFEST,
    LIBDRAGON_COMPOSE_FILE
  );
  if (!(await fileExists(composeFile))) {
    // Create the docker compose file
    fs.writeFile(
      composeFile,
      JSON.stringify(
        {
          version: '3.5',
          services: {
            toolchain: {
              image: '${IMAGE_NAME}',

              working_dir: '${CONTAINER_TARGET_PATH}',
              volumes: ['.:${CONTAINER_TARGET_PATH}'],
              entrypoint: ['tail', '-f', '/dev/null'],
            },
          },
        },
        null,
        '  '
      )
    );
  }

  // For imageName, flag has the highest priority followed by the one read from
  // the file and then if there is any matching container, name is read from it.
  // As last option fallback to default value.

  // If still have the container, read the image name from it as a last resort
  if (!info.imageName) {
    const containerId = await checkContainerExists(info);
    containerId &&
      (info.imageName = (
        await spawnProcess('docker', [
          'container',
          'inspect',
          containerId,
          '--format',
          '{{.Config.Image}}',
        ])
      ).trim());
  }

  log(`Active image name: ${info.imageName}`, true);
  log(`Active vendor directory: ${info.vendorDirectory}`, true);
  log(`Active vendor strategy: ${info.vendorStrategy}`, true);

  return info;
}

/**
 * @param info This is only the base info without action properties like showStatus
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

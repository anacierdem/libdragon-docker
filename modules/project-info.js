const path = require('path');
const os = require('os');
const fs = require('fs/promises');

const {
  checkContainerAndClean,
  initGitAndCacheContainerId,
} = require('./utils');

const { findNPMRoot } = require('./npm-utils');

const {
  LIBDRAGON_PROJECT_MANIFEST,
  CONFIG_FILE,
  DEFAULT_STRATEGY,
  LIBDRAGON_SUBMODULE,
  CACHED_CONTAINER_FILE,
  CONTAINER_TARGET_PATH,
  LIBDRAGON_BRANCH,
} = require('./constants');

const {
  fileExists,
  log,
  spawnProcess,
  toPosixPath,
  assert,
  ParameterError,
  isProjectAction,
  getImageName,
} = require('./helpers');

/**
 * @typedef { typeof import('./constants').NO_PROJECT_ACTIONS[number] } ActionsNoProject
 * @typedef { Exclude<keyof import('./parameters').Actions, ActionsNoProject> } ActionsWithProject
 * @typedef { import('./parameters').CommandlineOptions<ActionsNoProject> } ActionsNoProjectOptions
 * @typedef { import('./parameters').CommandlineOptions<ActionsWithProject> } ActionsWithProjectOptions
 *
 * This is all the potential CLI combinations
 * @typedef { {
 *  options: import('./parameters').CommandlineOptions
 * } } CLIInfo
 *
 * Then readProjectInfo creates two possible set of outputs. One is for actions
 * that don't need a project and one with project. This setup forces the actions
 * to not use detailed information if they are listed in NO_PROJECT_ACTIONS
 * @typedef { {
 *  options: ActionsNoProjectOptions
 * } } NoProjectInfo
 *
 * @typedef { {
 *  options: ActionsWithProjectOptions
 * } } ProjectInfo
 *
 * @typedef { {
 *  options: ActionsWithProjectOptions
 *  root: string;
 *  userInfo: os.UserInfo<string>;
 *  haveProjectConfig: boolean;
 *  imageName: string;
 *  vendorDirectory: string;
 *  vendorStrategy: import('./parameters').VendorStrategy;
 *  containerId?: string;
 *  activeBranchName: string;
 * } } LibdragonInfo
 */

/**
 * @param {LibdragonInfo} libdragonInfo
 */
async function findContainerId(libdragonInfo) {
  assert(
    !process.env.DOCKER_CONTAINER,
    new Error('[findContainerId] We should already know we are in a container.')
  );

  const idFile = path.join(libdragonInfo.root, '.git', CACHED_CONTAINER_FILE);
  if (await fileExists(idFile)) {
    const id = (await fs.readFile(idFile, { encoding: 'utf8' })).trim();
    log(`Read containerId: ${id}`, true);
    return id;
  }

  // TODO: use docker container ls -a --format "{{.Labels}}" instead
  // from what I remember this used to not work (i.e the property was not exposed before)
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
      // This shouldn't happen but if the user somehow deleted the .git folder
      // (we don't have the container id file at this point) we can recover the
      // project. This is safe and it is not executed if strategy is `manual`
      await initGitAndCacheContainerId({
        ...libdragonInfo,
        containerId: longId,
      });
      return longId;
    }
  }
}

/**
 * @param {string} start
 * @param {string} relativeFile
 * @returns {Promise<string | undefined>}
 */
async function findLibdragonRoot(
  start = '.',
  relativeFile = path.join(LIBDRAGON_PROJECT_MANIFEST, CONFIG_FILE)
) {
  const fileToCheck = path.join(start, relativeFile);
  log(`Checking if file exists: ${path.resolve(fileToCheck)}`, true);
  if (await fileExists(fileToCheck)) {
    return path.resolve(start);
  }

  const parent = path.resolve(start, '..');
  if (parent !== path.resolve(start)) {
    return findLibdragonRoot(parent, relativeFile);
  } else {
    return;
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

/**
 * @param {CLIInfo} optionInfo
 * @returns {Promise<LibdragonInfo | NoProjectInfo>}
 */
const readProjectInfo = async function (optionInfo) {
  // No need to do anything here if the action does not depend on the project
  // The only exception is the init and destroy actions, which do not need an
  // existing project but readProjectInfo must always run to analyze the situation
  if (!isProjectAction(optionInfo)) {
    return /** @type {NoProjectInfo} */ (optionInfo);
  }

  const projectRoot = await findLibdragonRoot();

  if (
    !projectRoot &&
    !['init', 'destroy'].includes(optionInfo.options.CURRENT_ACTION.name)
  ) {
    throw new ParameterError(
      'This is not a libdragon project. Initialize with `libdragon init` first.',
      optionInfo.options.CURRENT_ACTION.name
    );
  }

  const foundRoot =
    projectRoot ?? (await findNPMRoot()) ?? (await findGitRoot());
  if (!foundRoot) {
    log('Could not find project root, set as cwd.', true);
  }

  /** @type {LibdragonInfo} */
  let info = {
    ...optionInfo,
    root: foundRoot ?? process.cwd(),
    userInfo: os.userInfo(),

    // Use this to discriminate if there is a project when the command is run
    // Only used for the init action ATM, and it is not ideal to have this here
    haveProjectConfig: !!projectRoot,

    vendorDirectory: toPosixPath(path.join('.', LIBDRAGON_SUBMODULE)),
    vendorStrategy: DEFAULT_STRATEGY,

    activeBranchName: LIBDRAGON_BRANCH,

    // This is invalid at this point, but is overridden below from config file
    // or container if it doesn't exist in the file. If a flag is provided, it
    // will be overridden later.
    imageName: '',
  };

  log(`Project root: ${info.root}`, true);

  if (projectRoot) {
    info = {
      ...info,
      ...JSON.parse(
        await fs.readFile(
          path.join(info.root, LIBDRAGON_PROJECT_MANIFEST, CONFIG_FILE),
          { encoding: 'utf8' }
        )
      ),
    };
  }

  if (!process.env.DOCKER_CONTAINER) {
    info.containerId = await findContainerId(info);
    log(`Active container id: ${info.containerId}`, true);
  }

  // If still have the container, read the image name from it
  // No need to do anything if we are in a container
  if (
    !process.env.DOCKER_CONTAINER &&
    !info.imageName &&
    info.containerId &&
    (await checkContainerAndClean(info))
  ) {
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

  // For imageName, flag has the highest priority followed by the one read from
  // the file and then if there is any matching container, name is read from it.
  // Next if `--branch` flag and as last option fallback to default value.
  // This represents the current value, so the flag should be processed later.
  // If we were to update it here, it would be impossible to know the change
  // with how we structure the code right now.
  info.imageName = info.imageName || getImageName(info.activeBranchName);

  log(`Active image name: ${info.imageName}`, true);
  log(`Active vendor directory: ${info.vendorDirectory}`, true);
  log(`Active vendor strategy: ${info.vendorStrategy}`, true);
  log(`Active branch: ${info.activeBranchName}`, true);

  return info;
};

/**
 * @param { LibdragonInfo | void } info This is only the base info without options
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

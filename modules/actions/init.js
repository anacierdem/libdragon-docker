const fs = require('fs/promises');
const path = require('path');

const chalk = require('chalk');

const { fn: install } = require('./install');
const { start } = require('./start');
const {
  installDependencies,
  tryCacheContainerId,
  updateImage,
  runGitMaybeHost,
} = require('./utils');

const {
  LIBDRAGON_PROJECT_MANIFEST,
  LIBDRAGON_SUBMODULE,
  LIBDRAGON_BRANCH,
  LIBDRAGON_GIT,
} = require('../constants');
const {
  log,
  copyDirContents,
  CommandError,
  ParameterError,
  ValidationError,
  toPosixPath,
  toNativePath,
} = require('../helpers');
const { setProjectInfoToSave } = require('../project-info');

const autoVendor = async (libdragonInfo) => {
  await runGitMaybeHost(libdragonInfo, ['init']);

  if (libdragonInfo.vendorStrategy === 'submodule') {
    await runGitMaybeHost(libdragonInfo, [
      'submodule',
      'add',
      '--force',
      '--name',
      LIBDRAGON_SUBMODULE,
      '--branch',
      LIBDRAGON_BRANCH,
      LIBDRAGON_GIT,
      libdragonInfo.vendorDirectory,
    ]);
  } else if (libdragonInfo.vendorStrategy === 'subtree') {
    // Create a commit if it does not exist. This is required for subtree.
    try {
      await runGitMaybeHost(libdragonInfo, ['rev-parse', 'HEAD']);
    } catch (e) {
      if (!(e instanceof CommandError)) throw e;

      // This will throw if git user name/email is not set up. Let's not assume
      // anything for now. This means subtree is not supported for someone without
      // git on the host machine.
      await runGitMaybeHost(libdragonInfo, [
        'commit',
        '--allow-empty',
        '-n',
        '-m',
        'Initial commit.',
      ]);
    }

    await runGitMaybeHost(libdragonInfo, [
      'subtree',
      'add',
      '--prefix',
      path.relative(libdragonInfo.root, libdragonInfo.vendorDirectory),
      LIBDRAGON_GIT,
      LIBDRAGON_BRANCH,
      '--squash',
    ]);
  }

  return libdragonInfo;
};

/**
 * Initialize a new libdragon project in current working directory
 * Also downloads the image
 */
async function init(libdragonInfo) {
  log(`Initializing a libdragon project at ${libdragonInfo.root}`);

  let newInfo = libdragonInfo;

  // Validate manifest
  const manifestPath = path.join(newInfo.root, LIBDRAGON_PROJECT_MANIFEST);
  const manifestStats = await fs.stat(manifestPath).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    return false;
  });

  if (manifestStats && !manifestStats.isDirectory()) {
    throw new ValidationError(
      'There is already a `.libdragon` file and it is not a directory.'
    );
  }

  // Validate vendoring strategy. Do not allow a switch after successful initialization
  if (
    newInfo.haveProjectConfig &&
    newInfo.options.VENDOR_STRAT &&
    newInfo.options.VENDOR_STRAT !== 'manual' &&
    newInfo.vendorStrategy !== newInfo.options.VENDOR_STRAT
  ) {
    throw new ParameterError(
      `Requested strategy switch: ${newInfo.vendorStrategy} -> ${newInfo.options.VENDOR_STRAT} It is not possible to switch vendoring strategy after initializing a project. You can always switch to manual and handle libdragon yourself.`
    );
  }

  // Update the strategy information for the project if the flag is provided
  if (newInfo.options.VENDOR_STRAT) {
    newInfo = setProjectInfoToSave({
      ...newInfo,
      vendorStrategy: newInfo.options.VENDOR_STRAT,
    });
  }

  // Update the directory information for the project if the flag is provided
  if (newInfo.options.VENDOR_DIR) {
    const relativeVendorDir = path.relative(
      libdragonInfo.root,
      libdragonInfo.options.VENDOR_DIR
    );
    // Validate vendoring path
    if (relativeVendorDir.startsWith('..')) {
      throw new ParameterError(
        `\`--directory=${libdragonInfo.options.VENDOR_DIR}\` is outside the project directory.`
      );
    }

    newInfo = setProjectInfoToSave({
      ...newInfo,
      // Immeditately convert it to a posix and relative path
      vendorDirectory: toPosixPath(relativeVendorDir),
    });
  }

  if (newInfo.haveProjectConfig) {
    log(
      `${path.join(
        newInfo.root,
        LIBDRAGON_PROJECT_MANIFEST
      )} exists. This is already a libdragon project, starting it...`
    );
    if (newInfo.options.DOCKER_IMAGE) {
      log(
        `Not changing docker image. Use the install action if you want to override the image.`
      );
    }
    // TODO: we may make sure git and submodule is initialized here
    await install(newInfo);
    return;
  }

  newInfo.imageName =
    (await updateImage(newInfo, newInfo.imageName)) || newInfo.imageName;
  // Download image and start it
  const containerReadyPromise = start(newInfo, true).then((newId) => ({
    ...newInfo,
    containerId: newId,
  }));

  let vendorAndGitReadyPromise = containerReadyPromise;
  if (newInfo.vendorStrategy !== 'manual') {
    const vendorTarget = path.relative(
      newInfo.root,
      toNativePath(newInfo.vendorDirectory)
    );
    const [vendorTargetExists] = await Promise.all([
      fs.stat(vendorTarget).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
        return false;
      }),
      containerReadyPromise,
    ]);

    if (vendorTargetExists) {
      throw new ValidationError(
        `${path.resolve(
          vendorTarget
        )} already exists. That is the libdragon vendoring target, please remove and retry.`
      );
    }

    vendorAndGitReadyPromise = containerReadyPromise.then(autoVendor);
  }

  log(`Preparing project files...`);
  const skeletonFolder = path.join(__dirname, '../../skeleton');

  await Promise.all([
    // We have created a new container, save the new info
    vendorAndGitReadyPromise.then(tryCacheContainerId),
    vendorAndGitReadyPromise.then(installDependencies),
    // node copy functions does not work with pkg
    copyDirContents(skeletonFolder, newInfo.root),
  ]);

  log(chalk.green(`libdragon ready at \`${newInfo.root}\`.`));
}

module.exports = {
  name: 'init',
  fn: init,
  showStatus: true,
  usage: {
    name: 'init',
    summary: 'Create a libdragon project in the current directory.',
    description: `Creates a libdragon project in the current directory. Every libdragon project will have its own docker container instance. If you are in a git repository or an NPM project, libdragon will be initialized at their root also marking there with a \`.libdragon\` folder. Do not remove the \`.libdragon\` folder and commit its contents if you are using source control, as it keeps persistent libdragon project information.

    By default, a git repository and a submodule at \`./libdragon\` will be created to automatically update the vendored libdragon files on subsequent \`update\`s. If you intend to opt-out from this feature, see the \`--strategy manual\` flag to provide your self-managed libdragon copy. The default behaviour is intended for users who primarily want to consume libdragon as is.

    If this is the first time you are creating a libdragon project at that location, this action will also create skeleton project files to kickstart things with the given image, if provided. For subsequent runs, it will act like \`start\` thus can be used to revive an existing project without modifying it.`,
    group: ['docker', 'vendoring'],
  },
};

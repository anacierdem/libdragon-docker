const fs = require('fs/promises');
const path = require('path');

const chalk = require('chalk').stderr;

const { start } = require('./start');
const {
  installDependencies,
  initGitAndCacheContainerId,
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
const { syncImageAndStart } = require('./update-and-start');

/**
 * @param {import('../project-info').LibdragonInfo} info
 * @returns {Promise<"submodule" | "subtree" | undefined>}
 */
const autoDetect = async (info) => {
  const vendorTarget = path.relative(
    info.root,
    toNativePath(info.vendorDirectory)
  );
  const vendorTargetExists = await fs.stat(vendorTarget).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    return false;
  });

  if (
    vendorTargetExists &&
    (await runGitMaybeHost(info, [
      'submodule',
      'status',
      info.vendorDirectory,
    ]).catch((e) => {
      if (!(e instanceof CommandError)) {
        throw e;
      }
    }))
  ) {
    log(`${info.vendorDirectory} is a submodule.`);
    return 'submodule';
  }

  if (vendorTargetExists) {
    const gitLogs = await runGitMaybeHost(info, ['log'], {
      inheritStdin: false,
      inheritStdout: false,
      inheritStderr: false,
    }).catch((e) => {
      if (!(e instanceof CommandError)) {
        throw e;
      }
    });

    if (
      gitLogs &&
      gitLogs.includes(`git-subtree-dir: ${info.vendorDirectory}`)
    ) {
      log(`${info.vendorDirectory} is a subtree.`);
      return 'subtree';
    }
  }
};

/**
 * @param {import('../project-info').LibdragonInfo} info
 */
const autoVendor = async (info) => {
  // Update the strategy information for the project if the flag is provided
  if (info.options.VENDOR_STRAT) {
    info.vendorStrategy = info.options.VENDOR_STRAT;
  }

  // Update the directory information for the project if the flag is provided
  if (info.options.VENDOR_DIR) {
    const relativeVendorDir = path.relative(info.root, info.options.VENDOR_DIR);
    // Validate vendoring path
    if (relativeVendorDir.startsWith('..')) {
      throw new ParameterError(
        `\`--directory=${info.options.VENDOR_DIR}\` is outside the project directory.`,
        info.options.CURRENT_ACTION.name
      );
    }

    // Immeditately convert it to a posix and relative path
    info.vendorDirectory = toPosixPath(relativeVendorDir);
  }

  // No need to do anything here
  if (info.vendorStrategy === 'manual') {
    return info;
  }

  await runGitMaybeHost(info, ['init']);

  // TODO: TS thinks this is already defined
  const detectedStrategy = await autoDetect(info);

  if (
    info.options.VENDOR_STRAT &&
    detectedStrategy &&
    detectedStrategy !== info.options.VENDOR_STRAT
  ) {
    throw new ValidationError(
      `${info.vendorDirectory} is a ${detectedStrategy} which is different from the provided strategy: ${info.options.VENDOR_STRAT}.`
    );
  }

  if (detectedStrategy) {
    log(
      `Using ${info.vendorDirectory} as a ${detectedStrategy} vendoring target.`
    );
    return {
      ...info,
      vendorStrategy: /** @type {import('../parameters').VendorStrategy} */ (
        detectedStrategy
      ),
    };
  }

  if (info.vendorStrategy === 'submodule') {
    try {
      await runGitMaybeHost(info, [
        'submodule',
        'add',
        '--force',
        '--name',
        LIBDRAGON_SUBMODULE,
        '--branch',
        LIBDRAGON_BRANCH,
        LIBDRAGON_GIT,
        info.vendorDirectory,
      ]);
    } catch (e) {
      if (!(e instanceof CommandError)) throw e;
      // We speculate this is caused by the user, so replace it with a more useful error message.
      e.message = `Unable to create submodule. If you have copied the executable in your project folder or you have a file named ${info.vendorDirectory}, removing it might solve this issue. Original error:\n${e.message}`;
      throw e;
    }

    return info;
  }

  if (info.vendorStrategy === 'subtree') {
    // Create a commit if it does not exist. This is required for subtree.
    try {
      await runGitMaybeHost(info, ['rev-parse', 'HEAD']);
    } catch (e) {
      if (!(e instanceof CommandError)) throw e;

      // This will throw if git user name/email is not set up. Let's not assume
      // anything for now. This means subtree is not supported for someone without
      // git on the host machine.
      await runGitMaybeHost(info, [
        'commit',
        '--allow-empty',
        '-n',
        '-m',
        'Initial commit.',
      ]);
    }

    await runGitMaybeHost(info, [
      'subtree',
      'add',
      '--prefix',
      path.relative(info.root, info.vendorDirectory),
      LIBDRAGON_GIT,
      LIBDRAGON_BRANCH,
      '--squash',
    ]);
    return info;
  }

  return info;
};

/**
 * Initialize a new libdragon project in current working directory
 * Also downloads the image
 * @param {import('../project-info').LibdragonInfo} info
 */
async function init(info) {
  log(`Initializing a libdragon project at ${info.root}`);

  // Validate manifest
  const manifestPath = path.join(info.root, LIBDRAGON_PROJECT_MANIFEST);
  const manifestStats = await fs.stat(manifestPath).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    return /** @type {const} */ (false);
  });

  if (manifestStats && !manifestStats.isDirectory()) {
    throw new ValidationError(
      'There is already a `.libdragon` file and it is not a directory.'
    );
  }

  if (info.haveProjectConfig) {
    log(
      `${path.join(
        info.root,
        LIBDRAGON_PROJECT_MANIFEST
      )} exists. This is already a libdragon project, starting it...`
    );
    if (info.options.DOCKER_IMAGE) {
      log(
        `Not changing docker image. Use the install action if you want to override the image.`
      );
    }
    if (info.options.DOCKER_IMAGE) {
      info = await syncImageAndStart(info);
    } else {
      info = {
        ...info,
        containerId: await start(info),
      };
    }
    info = await autoVendor(info);
    await installDependencies(info);
    return info;
  }

  await updateImage(info, info.imageName);

  // Download image and start it
  info.containerId = await start(info);

  // We have created a new container, save the new info ASAP
  await initGitAndCacheContainerId(
    /** @type Parameters<initGitAndCacheContainerId>[0] */ (info)
  );

  info = await autoVendor(info);

  log(`Preparing project files...`);
  const skeletonFolder = path.join(__dirname, '../../skeleton');

  await Promise.all([
    installDependencies(info),
    // node copy functions does not work with pkg
    copyDirContents(skeletonFolder, info.root),
  ]);

  log(chalk.green(`libdragon ready at \`${info.root}\`.`));
  return info;
}

module.exports = /** @type {const} */ ({
  name: 'init',
  fn: init,
  forwardsRestParams: false,
  usage: {
    name: 'init',
    summary: 'Create a libdragon project in the current directory.',
    description: `Creates a libdragon project in the current directory. Every libdragon project will have its own docker container instance. If you are in a git repository or an NPM project, libdragon will be initialized at their root also marking there with a \`.libdragon\` folder. Do not remove the \`.libdragon\` folder and commit its contents if you are using source control, as it keeps persistent libdragon project information.

    By default, a git repository and a submodule at \`./libdragon\` will be created to automatically update the vendored libdragon files on subsequent \`update\`s. If you intend to opt-out from this feature, see the \`--strategy manual\` flag to provide your self-managed libdragon copy. The default behaviour is intended for users who primarily want to consume libdragon as is.

    If this is the first time you are creating a libdragon project at that location, this action will also create skeleton project files to kickstart things with the given image, if provided. For subsequent runs, it will act like \`start\` thus can be used to revive an existing project without modifying it.

    If you have an existing project with an already vendored submodule or subtree libdragon copy, \`init\` will automatically detect it at the provided \`--directory\`.`,
    group: ['docker', 'vendoring'],
  },
});

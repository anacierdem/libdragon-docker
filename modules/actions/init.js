/// <reference path="../../globals.d.ts" />

const fs = require('fs/promises');
const _fs = require('fs');
const path = require('path');

const chalk = require('chalk').stderr;

const { start } = require('./start');
const {
  installDependencies,
  initGitAndCacheContainerId,
  updateImage,
  runGitMaybeHost,
  destroyContainer,
  ensureGit,
} = require('../utils');

const {
  LIBDRAGON_PROJECT_MANIFEST,
  LIBDRAGON_SUBMODULE,
  LIBDRAGON_GIT,
} = require('../constants');
const {
  log,
  CommandError,
  ParameterError,
  ValidationError,
  toPosixPath,
  toNativePath,
  getImageName,
} = require('../helpers');

const main_c = globalThis.PACKAGED
  ? // @ts-ignore-next-line
    /** @type {string} */ (require('../../skeleton/src/main.c'))
  : _fs.readFileSync(path.join(__dirname, '../../skeleton/src/main.c'), 'utf8');

const makefile = globalThis.PACKAGED
  ? // @ts-ignore-next-line
    /** @type {string} */ require('../../skeleton/Makefile.mk')
  : _fs.readFileSync(
      path.join(__dirname, '../../skeleton/Makefile.mk'),
      'utf8'
    );

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
    (await runGitMaybeHost(
      info,
      ['submodule', 'status', info.vendorDirectory],
      {
        inheritStdin: false,
        inheritStdout: false,
        inheritStderr: false,
      }
    ).catch((e) => {
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

  // Container re-init breaks file modes assume there is git for this case.
  if (!process.env.DOCKER_CONTAINER) {
    await ensureGit(info);
  }

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
        info.activeBranchName,
        LIBDRAGON_GIT,
        info.vendorDirectory,
      ]);
    } catch (e) {
      if (!(e instanceof CommandError)) throw e;
      // We speculate this is caused by the user, so replace it with a more useful error message.
      e.message = `Unable to create submodule. If you have copied the executable in your project folder or you have a file named ${info.vendorDirectory}, removing it might solve this issue. Original error:\n${e.message}`;
      if (e.out) {
        e.message += `\n${e.out}`;
      }
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
      // TODO: this is probably creating an unnecessary commit for someone who
      // just created a git repo and knows what they are doing.
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
      info.activeBranchName,
      '--squash',
    ]);
    return info;
  }

  return info;
};

/**
 * @param {import('../project-info').LibdragonInfo} info
 */
async function copyFiles(info) {
  // TODO: make use of VFS, this is far from ideal
  const srcPath = path.join(info.root, 'src');

  const srcStat = await fs.stat(srcPath).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    return null;
  });

  if (srcStat && !srcStat.isDirectory()) {
    log(`${srcPath} is not a directory, skipping.`);
    return;
  }

  if (!srcStat) {
    log(`Creating a directory at ${srcPath}.`, true);
    await fs.mkdir(srcPath);
  }

  const makefilePath = path.join(info.root, 'Makefile');
  await fs
    .writeFile(makefilePath, makefile, {
      flag: 'wx',
    })
    .catch(() => {
      log(`${makefilePath} already exists, skipping.`);
    });

  const mainPath = path.join(info.root, 'src', 'main.c');
  await fs
    .writeFile(mainPath, main_c, {
      flag: 'wx',
    })
    .catch(() => {
      log(`${mainPath} already exists, skipping.`);
    });
}

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
    if (!process.env.DOCKER_CONTAINER) {
      if (info.options.DOCKER_IMAGE) {
        // The logic here resembles syncImageAndStart but it aims at being idempotent
        // w.r.t the container when called without any additional flag.
        // Download the new image and if it is different, re-create the container
        if (await updateImage(info, info.options.DOCKER_IMAGE)) {
          await destroyContainer(info);
        }

        info = {
          ...info,
          imageName: info.options.DOCKER_IMAGE,
        };
      }
      info = {
        ...info,
        containerId: await start(info),
      };
    }

    info = await autoVendor(info);
    await installDependencies(info);
    return info;
  }

  if (!process.env.DOCKER_CONTAINER) {
    let activeBranchName = info.options.BRANCH ?? info.activeBranchName;
    let shouldOverrideBranch = !!info.options.BRANCH;

    if ((await autoDetect(info)) === 'submodule') {
      try {
        const existingBranchName = await runGitMaybeHost(
          info,
          [
            '-C',
            path.relative(info.root, info.vendorDirectory),
            'rev-parse',
            '--abbrev-ref',
            'HEAD',
          ],
          {
            inheritStdin: false,
            inheritStdout: false,
            inheritStderr: false,
          }
        );
        activeBranchName = existingBranchName.trim();
        shouldOverrideBranch = !!activeBranchName;
      } catch {
        // If we can't get the branch name, we will use the default
      }
    }

    info = {
      ...info,
      activeBranchName,
      // We don't have a config yet, this is a fresh project, override with the
      // image flag if provided.  Also see https://github.com/anacierdem/libdragon-docker/issues/66
      // Next, if `--branch` flag is provided use that or the one recovered from
      // the submodule.
      imageName:
        (info.options.DOCKER_IMAGE ??
          (shouldOverrideBranch && getImageName(activeBranchName))) ||
        info.imageName,
    };
    // Download image and start it
    await updateImage(info, info.imageName);
    info.containerId = await start(info);
    // We have created a new container, save the new info ASAP
    // When in a container, we should already have git
    // Re-initing breaks file modes anyways
    // TODO: if this fails, we leave the project in a bad state
    await initGitAndCacheContainerId(
      /** @type Parameters<initGitAndCacheContainerId>[0] */ (info)
    );
  }

  info = await autoVendor(info);

  log(`Preparing project files...`);

  await Promise.all([installDependencies(info), copyFiles(info)]);

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
    description: `Creates a libdragon project in the current directory. Every libdragon project will have its own docker container instance. If you are in a git repository or an NPM project, libdragon will be initialized at their root also marking there with a \`.libdragon\` folder. When running in a submodule, initializion will take place at that level rather than the superproject. Do not remove the \`.libdragon\` folder and commit its contents if you are using source control, as it keeps persistent libdragon project information.

    By default, a git repository and a submodule at \`./libdragon\` will be created to automatically update the vendored libdragon files on subsequent \`update\`s. If you intend to opt-out from this feature, see the \`--strategy manual\` flag to provide your self-managed libdragon copy. The default behaviour is intended for users who primarily want to consume libdragon as is.

    If this is the first time you are creating a libdragon project at that location, this action will also create skeleton project files to kickstart things with the given image, if provided. For subsequent runs without any parameter, it will act like \`start\` thus can be used to revive an existing project without modifying it.

    If you have an existing project with an already vendored submodule or subtree libdragon copy, \`init\` will automatically detect it at the provided \`--directory\`.`,
    group: ['docker', 'vendoring', '_none'],

    optionList: [
      {
        name: 'branch',
        description:
          'Provide a different branch to initialize libdragon. It will also change the toolchain docker image to be based on the given branch but `--image` will have precedence. Defaults to `trunk` & `latest` image.',
        alias: 'b',
        typeLabel: '<branch>',
      },
    ],
  },
});

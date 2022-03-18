const fsp = require('fs/promises');
const path = require('path');

const chalk = require('chalk');

const { LIBDRAGON_PROJECT_MANIFEST } = require('../constants');
const { fn: install } = require('./install');
const { fn: start } = require('./start');
const { initSubmodule, installDependencies } = require('./utils');

const { log, copyDirContents } = require('../helpers');

const {
  setProjectInfoToSave,
  tryCacheContainerId,
  updateImage,
} = require('./utils');

/**
 * Initialize a new libdragon project in current working directory
 * Also downloads the image
 */
async function init(libdragonInfo) {
  log(`Initializing a libdragon project at ${libdragonInfo.root}`);

  // TODO: use exists instead & check if it is a directory
  const files = await fsp.readdir(libdragonInfo.root);

  const manifestFile = files.find(
    (name) => name === LIBDRAGON_PROJECT_MANIFEST
  );

  let newInfo = libdragonInfo;

  // Update the directory information for the project if the flag is provided
  if (libdragonInfo.options.VENDOR_DIR) {
    newInfo = setProjectInfoToSave({
      ...newInfo,
      vendorDirectory: libdragonInfo.options.VENDOR_DIR,
    });
  }

  // Update the strategy information for the project if the flag is provided
  if (libdragonInfo.options.VENDOR_STRAT) {
    newInfo = setProjectInfoToSave({
      ...newInfo,
      vendorStrategy: libdragonInfo.options.VENDOR_STRAT,
    });
  }

  if (manifestFile) {
    log(
      `${path.join(
        newInfo.root,
        manifestFile
      )} exists. This is already a libdragon project, starting it...`
    );
    if (newInfo.options.DOCKER_IMAGE) {
      log(
        `Not changing docker image. Use the install action if you want to override the image.`
      );
    }
    await install(newInfo);
    return;
  }

  // Download image and start it
  const containerReadyPromise = start({
    ...newInfo,
    imageName:
      (await updateImage(newInfo, newInfo.imageName)) || newInfo.imageName,
  });

  let vendorAndGitReadyPromise = containerReadyPromise;
  if (newInfo.vendorStrategy === 'submodule') {
    const relativePath = path.relative(newInfo.root, newInfo.vendorDirectory);

    if (relativePath.startsWith('..')) {
      throw new Error(
        'When using `submodule` strategy, `--directory` must be inside the project folder.'
      );
    }

    const libdragonFile = files.find((name) =>
      name.match(new RegExp(`^${relativePath}.?`))
    );

    if (libdragonFile) {
      throw new Error(
        `${path.join(
          newInfo.root,
          libdragonFile
        )} already exists. That is the libdragon vendoring target, please remove and retry. Move libdragon.exe to somewhere else if you are trying to use it inside your project folder.`
      );
    }

    vendorAndGitReadyPromise = containerReadyPromise.then((newId) =>
      initSubmodule({
        ...newInfo,
        containerId: newId,
      })
    );
  }

  log(`Preparing project files...`);
  const skeletonFolder = path.join(__dirname, '../skeleton');

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
};

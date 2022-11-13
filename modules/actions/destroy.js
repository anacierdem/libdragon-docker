const fs = require('fs/promises');
const path = require('path');

const { destroyContainer } = require('./utils');
const { CONFIG_FILE, LIBDRAGON_PROJECT_MANIFEST } = require('../constants');
const { fileExists, dirExists, log, ValidationError } = require('../helpers');
const chalk = require('chalk');

/**
 * @param {import('../project-info').LibdragonInfo} libdragonInfo
 */
const destroy = async (libdragonInfo) => {
  if (process.env.DOCKER_CONTAINER) {
    throw new ValidationError(
      `Not possible to destroy the container from inside.`
    );
  }

  await destroyContainer(libdragonInfo);

  const projectPath = path.join(libdragonInfo.root, LIBDRAGON_PROJECT_MANIFEST);
  const configPath = path.join(projectPath, CONFIG_FILE);

  if (await fileExists(configPath)) {
    await fs.rm(configPath);
  }
  if (await dirExists(projectPath)) {
    await fs.rmdir(projectPath);
  }

  log(chalk.green('Done cleanup.'));
};

module.exports = /** @type {const} */ ({
  name: 'destroy',
  fn: destroy,
  forwardsRestParams: false,
  usage: {
    name: 'destroy',
    summary: 'Do clean-up for current project.',
    description: `Removes libdragon configuration from current project and removes any known containers but will not touch previously vendored files. \`libdragon\` will not work anymore for this project.`,
  },
});

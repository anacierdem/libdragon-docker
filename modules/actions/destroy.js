const fs = require('fs/promises');
const path = require('path');

const { destroyContainer } = require('./utils');
const { CONFIG_FILE, LIBDRAGON_PROJECT_MANIFEST } = require('../constants');
const { fileExists, dirExists, log } = require('../helpers');
const chalk = require('chalk');

const destroy = async (libdragonInfo) => {
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

module.exports = {
  name: 'destroy',
  fn: destroy,
  mustHaveProject: false,
  usage: {
    name: 'destroy',
    summary: 'Do clean-up for current project.',
    description: `Removes libdragon configuration from current project and removes any known containers but will not touch previously vendored files. \`libdragon\` will not work anymore for this project.

      Must be run in an initialized libdragon project.`,
  },
};

const fs = require('fs/promises');
const path = require('path');

const { mustHaveProject, destroyContainer } = require('./utils');
const { CONFIG_FILE, LIBDRAGON_PROJECT_MANIFEST } = require('../constants');
const { fileExists, dirExists } = require('../helpers');

const clean = async (libdragonInfo) => {
  await mustHaveProject(libdragonInfo);

  await destroyContainer(libdragonInfo);

  const projectPath = path.join(libdragonInfo.root, LIBDRAGON_PROJECT_MANIFEST);
  const configPath = path.join(projectPath, CONFIG_FILE);

  if (await fileExists(configPath)) {
    await fs.rm(configPath);
  }
  if (dirExists(projectPath)) {
    await fs.rmdir(projectPath);
  }
};

module.exports = {
  name: 'clean',
  fn: clean,
  showStatus: true,
  usage: {
    name: 'clean',
    summary: 'Do clean-up for current project.',
    description: `Removes libdragon configuration from current project and removes any known containers but will not touch previously vendored files. \`libdragon\` will not work anymore for this project.

      Must be run in an initialized libdragon project.`,
  },
};

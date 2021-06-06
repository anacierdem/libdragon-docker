const { version } = require('../package.json');

const BASE_IMAGE_VERSION = 'toolchain';
const PROJECT_NAME = process.env.npm_package_name || 'libdragon'; // Use active package name when available

const IS_CI = process.env.CI === 'true';
// Use base version if building self in CI, actual version o/w
// When self building, the new version does not exist yet
const SELF_BUILD = PROJECT_NAME === 'libdragon' ? IS_CI : false;

module.exports = {
  DOCKER_HUB_NAME: 'anacierdem/libdragon',
  PROJECT_NAME,
  IS_CI,
  SELF_BUILD,
  BASE_IMAGE_VERSION,
  IMAGE_VERSION: version,
};

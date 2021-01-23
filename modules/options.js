// Default options
const options = {
  PROJECT_NAME: process.env.npm_package_name || 'libdragon', // Use active package name when available
  BYTE_SWAP: false,
  MOUNT_PATH: process.cwd(),
  IS_CI: process.env.CI === 'true',
};

// Use base version if building self in CI, actual version o/w
// When self building, the new version does not exist yet
options.SELF_BUILD =
  options.PROJECT_NAME === 'libdragon' ? options.IS_CI : false;

module.exports = {
  options,
};

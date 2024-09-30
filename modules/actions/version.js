const sea = require('node:sea');

const { print } = require('../helpers');

const printVersion = async () => {
  // Version is set during build time. If it is not set, it is set to the
  // package.json version. This is done to avoid bundling the package.json
  // (which would be out of date) with the built one.
  if (!globalThis.VERSION) {
    const { version } = require('../../package.json');
    globalThis.VERSION = version;
  }
  print(`libdragon-cli v${globalThis.VERSION} ${sea.isSea() ? '(sea)' : ''}`);
};

module.exports = /** @type {const} */ ({
  name: 'version',
  fn: printVersion,
  forwardsRestParams: false,
  usage: {
    name: 'version',
    summary: 'Display cli version.',
    description: `Displays currently running cli version.`,
  },
});

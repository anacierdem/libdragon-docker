const { version } = require('../../package.json');
const { log } = require('../helpers');

const printVersion = async () => {
  log(`libdragon-cli v${version}`);
};

module.exports = {
  name: 'version',
  fn: printVersion,
  showStatus: false,
  usage: {
    name: 'version',
    summary: 'Display cli version.',
    description: `Displays currently running cli version.`,
  },
};

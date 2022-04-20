const chalk = require('chalk').stderr;

const { log } = require('./helpers');
const actions = require('./actions');
const { STATUS_BAD_PARAM } = require('./constants');
const { globals } = require('./globals');

const parseParameters = async (argv) => {
  const options = {
    EXTRA_PARAMS: [],
    CURRENT_ACTION: undefined,
  };

  for (let i = 2; i < argv.length; i++) {
    const val = argv[i];

    if (['--verbose', '-v'].includes(val)) {
      options.VERBOSE = true;
      globals.verbose = true;
      continue;
    }

    // TODO: we might move these to actions as well.
    if (['--image', '-i'].includes(val)) {
      options.DOCKER_IMAGE = argv[++i];
      continue;
    } else if (val.indexOf('--image=') === 0) {
      options.DOCKER_IMAGE = val.split('=')[1];
      continue;
    }

    if (['--directory', '-d'].includes(val)) {
      options.VENDOR_DIR = argv[++i];
      continue;
    } else if (val.indexOf('--directory=') === 0) {
      options.VENDOR_DIR = val.split('=')[1];
      continue;
    }

    if (['--strategy', '-s'].includes(val)) {
      options.VENDOR_STRAT = argv[++i];
      continue;
    } else if (val.indexOf('--strategy=') === 0) {
      options.VENDOR_STRAT = val.split('=')[1];
      continue;
    }

    if (['--file', '-f'].includes(val)) {
      options.FILE = argv[++i];
      continue;
    } else if (val.indexOf('--file=') === 0) {
      options.FILE = val.split('=')[1];
      continue;
    }

    if (val.indexOf('-') == 0) {
      log(chalk.red(`Invalid flag \`${val}\``));
      process.exit(STATUS_BAD_PARAM);
    }

    if (options.CURRENT_ACTION) {
      log(chalk.red(`Expected only a single action, found: \`${val}\``));
      process.exit(STATUS_BAD_PARAM);
    }

    options.CURRENT_ACTION = actions[val];

    if (!options.CURRENT_ACTION) {
      log(chalk.red(`Invalid action \`${val}\``));
      process.exit(STATUS_BAD_PARAM);
    }

    if (options.CURRENT_ACTION.forwardsRestParams) {
      options.EXTRA_PARAMS = argv.slice(i + 1);
      break;
    }
  }

  if (!options.CURRENT_ACTION) {
    log(chalk.red('No action provided'));
    process.exit(STATUS_BAD_PARAM);
  }

  if (
    options.CURRENT_ACTION === actions.exec &&
    options.EXTRA_PARAMS.length === 0
  ) {
    log(chalk.red('You should provide a command to exec'));
    process.exit(STATUS_BAD_PARAM);
  }

  if (
    ![actions.init, actions.install, actions.update].includes(
      options.CURRENT_ACTION
    ) &&
    options.DOCKER_IMAGE
  ) {
    log(chalk.red('Invalid flag: image'));
    process.exit(STATUS_BAD_PARAM);
  }

  if (
    options.VENDOR_STRAT &&
    !['submodule', 'subtree', 'manual'].includes(options.VENDOR_STRAT)
  ) {
    log(chalk.red(`Invalid strategy \`${options.VENDOR_STRAT}\``));
    process.exit(STATUS_BAD_PARAM);
  }

  if (![actions.disasm].includes(options.CURRENT_ACTION) && options.FILE) {
    log(chalk.red('Invalid flag: file'));
    process.exit(STATUS_BAD_PARAM);
  }

  return { options };
};

module.exports = {
  parseParameters,
};

#!/usr/bin/env node

const chalk = require('chalk');
const { readProjectInfo, globals } = require('./modules/helpers');
const actions = require('./modules/actions');

const STATUS_OK = 0;
const STATUS_ERROR = 1;
const STATUS_BAD_PARAM = 2;

// Command line options
const options = {
  BYTE_SWAP: false,
  DOCKER_IMAGE: undefined,
  VERBOSE: false,

  ACTION: undefined,
  PARAMS: undefined,
};

for (let i = 2; i < process.argv.length; i++) {
  const val = process.argv[i];

  if (val === '--help') {
    actions.help();
    process.exit(STATUS_OK);
  }

  if (val === '--byte-swap') {
    options.BYTE_SWAP = true;
    continue;
  }

  if (val === '--verbose') {
    options.VERBOSE = true;
    globals.verbose = true;
    continue;
  }

  if (val === '--image') {
    options.DOCKER_IMAGE = process.argv[++i];
    continue;
  }

  if (val.indexOf('--') >= 0) {
    console.error(chalk.red(`Invalid flag \`${val}\``));
    actions.help();
    process.exit(STATUS_BAD_PARAM);
  }

  options.ACTION = actions[val];

  if (typeof options.ACTION !== 'function') {
    console.error(chalk.red(`Invalid action \`${val}\``));
    actions.help();
    process.exit(STATUS_BAD_PARAM);
  }

  options.PARAMS = process.argv.slice(i + 1);
  break;
}

readProjectInfo()
  .then((info) =>
    options.ACTION(
      {
        ...info,
        options,
      },
      options.PARAMS
    )
  )
  .catch((e) => {
    if (!e.showOutput || globals.verbose) {
      console.error(chalk.red(e.stack ?? e.message));
      e.out && process.stderr.write(e.out);
      process.exit(STATUS_ERROR);
    }
    process.exit(e.code || STATUS_ERROR);
  })
  .finally(() => {
    process.exit(STATUS_OK);
  });

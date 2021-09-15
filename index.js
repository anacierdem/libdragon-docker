#!/usr/bin/env node

const chalk = require('chalk');
const { readProjectInfo, CommandError, globals } = require('./modules/helpers');
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

// Allow standard io here
/* eslint-disable no-console */

for (let i = 2; i < process.argv.length; i++) {
  const val = process.argv[i];

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
    actions.help.fn();
    process.exit(STATUS_BAD_PARAM);
  }

  if (options.ACTION) {
    console.error(
      chalk.red(`Expected only a single action, found: \`${val}\``)
    );
    actions.help.fn();
    process.exit(STATUS_BAD_PARAM);
  }

  options.ACTION = actions[val];

  if (!options.ACTION) {
    console.error(chalk.red(`Invalid action \`${val}\``));
    actions.help.fn();
    process.exit(STATUS_BAD_PARAM);
  }

  if (options.ACTION.forwardsRestParams) {
    options.PARAMS = process.argv.slice(i + 1);
    break;
  }
}

readProjectInfo()
  .then((info) =>
    options.ACTION.fn(
      {
        ...info,
        options,
      },
      options.PARAMS
    )
  )
  .catch((e) => {
    const userTargetedError = e instanceof CommandError && e.showOutput;

    // Show additional information to user if verbose or we did a mistake
    if (globals.verbose || !userTargetedError) {
      console.error(chalk.red(e.stack ?? e.message));
    }

    // Print the underlying error out only if verbose and we did a mistake
    // user errors wil already pipe their stderr.
    if (globals.verbose && !userTargetedError) {
      e.out &&
        process.stderr.write(chalk.red(`Command error output:\n${e.out}`));
    }

    // Try to exit with underlying code
    if (userTargetedError) {
      process.exit(e.code || STATUS_ERROR);
    }

    // We don't have a user targeted error anymore, we did a mistake for sure
    process.exit(STATUS_ERROR);
  })
  .finally(() => {
    process.exit(STATUS_OK);
  });

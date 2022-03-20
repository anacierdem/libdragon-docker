#!/usr/bin/env node

const chalk = require('chalk');

const actions = require('./modules/actions');
const { fn: printUsage } = require('./modules/actions/help');
const {
  STATUS_OK,
  STATUS_BAD_PARAM,
  STATUS_ERROR,
} = require('./modules/constants');
const { globals } = require('./modules/globals');
const { CommandError } = require('./modules/helpers');
const { readProjectInfo, writeProjectInfo } = require('./modules/project-info');

let options = {},
  currentAction;

for (let i = 2; i < process.argv.length; i++) {
  const val = process.argv[i];

  // Allow console here
  /* eslint-disable no-console */

  if (['--verbose', '-v'].includes(val)) {
    options.VERBOSE = true;
    globals.verbose = true;
    continue;
  }

  if (['--image', '-i'].includes(val)) {
    options.DOCKER_IMAGE = process.argv[++i];
    continue;
  } else if (val.indexOf('--image=') === 0) {
    options.DOCKER_IMAGE = val.split('=')[1];
    continue;
  }

  if (['--directory', '-d'].includes(val)) {
    options.VENDOR_DIR = process.argv[++i];
    continue;
  } else if (val.indexOf('--directory=') === 0) {
    options.VENDOR_DIR = val.split('=')[1];
    continue;
  }

  if (['--strategy', '-s'].includes(val)) {
    options.VENDOR_STRAT = process.argv[++i];
    continue;
  } else if (val.indexOf('--strategy=') === 0) {
    options.VENDOR_STRAT = val.split('=')[1];
    continue;
  }

  if (val.indexOf('--') >= 0) {
    console.error(chalk.red(`Invalid flag \`${val}\``));
    printUsage();
    process.exit(STATUS_BAD_PARAM);
  }

  if (currentAction) {
    console.error(
      chalk.red(`Expected only a single action, found: \`${val}\``)
    );
    printUsage();
    process.exit(STATUS_BAD_PARAM);
  }

  currentAction = actions[val];

  if (!currentAction) {
    console.error(chalk.red(`Invalid action \`${val}\``));
    printUsage();
    process.exit(STATUS_BAD_PARAM);
  }

  if (currentAction.forwardsRestParams) {
    options.PARAMS = process.argv.slice(i + 1);
    break;
  }
}

if (!currentAction) {
  console.error(chalk.red('No action provided'));
  printUsage();
  process.exit(STATUS_BAD_PARAM);
}

if (currentAction === actions.exec && options.PARAMS.length === 0) {
  console.error(chalk.red('You should provide a command to exec'));
  printUsage(undefined, [currentAction.name]);
  process.exit(STATUS_BAD_PARAM);
}

if (
  ![actions.init, actions.install, actions.update].includes(currentAction) &&
  options.DOCKER_IMAGE
) {
  console.error(chalk.red('Invalid flag: image'));
  printUsage(undefined, [currentAction.name]);
  process.exit(STATUS_BAD_PARAM);
}

if (
  options.VENDOR_STRAT &&
  !['submodule', 'subtree', 'manual'].includes(options.VENDOR_STRAT)
) {
  console.error(chalk.red(`Invalid strategy \`${options.VENDOR_STRAT}\``));
  printUsage();
  process.exit(STATUS_BAD_PARAM);
}

readProjectInfo()
  .then((info) =>
    currentAction.fn(
      {
        ...info,
        options,
        ...currentAction,
      },
      options.PARAMS ?? []
    )
  )
  .catch((e) => {
    const userTargetedError = e instanceof CommandError && e.userCommand;

    // Show additional information to user if verbose or we did a mistake
    if (globals.verbose || !userTargetedError) {
      console.error(chalk.red(globals.verbose ? e.stack : e.message));
    }

    // Print the underlying error out only if not verbose and we did a mistake
    // user errors will already pipe their stderr. All command errors also go
    // to the stderr when verbose
    if (!globals.verbose && !userTargetedError && e.out) {
      process.stderr.write(chalk.red(`Command error output:\n${e.out}`));
    }

    // Try to exit with underlying code
    if (userTargetedError) {
      process.exit(e.code || STATUS_ERROR);
    }

    // We don't have a user targeted error anymore, we did a mistake for sure
    process.exit(STATUS_ERROR);
  })
  .then(() => {
    // Everything was done, update the configuration file if not exiting early
    return writeProjectInfo();
  })
  .finally(() => {
    process.exit(STATUS_OK);
  });

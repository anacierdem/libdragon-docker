#!/usr/bin/env node

const commandLineArgs = require('command-line-args');
const chalk = require('chalk');
const { readProjectInfo, CommandError, globals } = require('./modules/helpers');
const actions = require('./modules/actions');
const { printUsage } = require('./modules/usage');

const STATUS_OK = 0;
const STATUS_ERROR = 1;
const STATUS_BAD_PARAM = 2;

let options = {},
  currentAction;

try {
  options = commandLineArgs(
    [
      { name: 'action', defaultOption: true },
      { name: 'verbose', alias: 'v', type: Boolean },
    ],
    { stopAtFirstUnknown: true }
  );
  globals.verbose = options.verbose;

  const imageOption = { name: 'image', alias: 'i', type: String };

  // Allow console here
  /* eslint-disable no-console */

  currentAction = actions[options.action];

  if (!currentAction) {
    if (options.action === undefined) {
      console.error(chalk.red('No action provided'));
    } else {
      console.error(chalk.red(`Invalid action \`${options.action}\``));
    }

    printUsage();
    process.exit(STATUS_BAD_PARAM);
  }

  // Parse additional options
  const argv = options._unknown || [];
  if (['init', 'install', 'update'].includes(options.action)) {
    options = {
      ...options,
      ...commandLineArgs([imageOption], {
        argv,
      }),
    };
  }

  if (currentAction === actions.exec && options._unknown.length === 0) {
    console.error(chalk.red('You should provide a command to exec'));
    printUsage();
    process.exit(STATUS_BAD_PARAM);
  }
} catch (err) {
  if (err.name === 'UNKNOWN_OPTION') {
    console.error(chalk.red(`Invalid flag \`${err.optionName}\``));
    printUsage();
    process.exit(STATUS_BAD_PARAM);
  }

  if (err.name === 'UNKNOWN_VALUE') {
    console.error(
      chalk.red(`Expected only a single action, found: \`${err.value}\``)
    );
    printUsage();
    process.exit(STATUS_BAD_PARAM);
  }

  // Other parsing error
  console.error(chalk.red(globals.verbose ? err.stack : err.message));
  process.exit(STATUS_ERROR);
}

readProjectInfo()
  .then((info) =>
    currentAction.fn(
      {
        ...info,
        options,
        ...currentAction,
      },
      currentAction.forwardsRestParams ? options._unknown ?? [] : undefined
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
  .finally(() => {
    process.exit(STATUS_OK);
  });

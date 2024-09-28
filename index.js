#!/usr/bin/env node

const chalk = require('chalk').stderr;

const {
  STATUS_OK,
  STATUS_BAD_PARAM,
  STATUS_ERROR,
  STATUS_VALIDATION_ERROR,
} = require('./modules/constants');
const { globals } = require('./modules/globals');
const {
  CommandError,
  ParameterError,
  ValidationError,
  log,
} = require('./modules/helpers');
const { parseParameters } = require('./modules/parameters');
const { readProjectInfo, writeProjectInfo } = require('./modules/project-info');

// Note: it is not possible to merge these type definitions in a single comment
/**
 * @template {any} [U=any]
 * @typedef {(U extends any ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never} UnionToIntersection
 */
/**
 * @template {any} [K=any]
 * never does not break the call `info.options.CURRENT_ACTION.fn`
 * @typedef {[K] extends [UnionToIntersection<K>] ? any : unknown} NoUnion
 * @typedef {NoUnion<Exclude<Parameters<import('./modules/parameters').Actions[import('./modules/project-info').ActionsNoProject]['fn']>[0], undefined>>} EitherCLIOrLibdragonInfo
 */

// This is overridden when building for SEA. When running from local or NPM,
// the package.json version is used by the version action. esbuild will give
// a warning for this assignment, but it works as expected.
globalThis.VERSION = "";

parseParameters(process.argv)
  .then(readProjectInfo)
  .then((info) => {
    return info.options.CURRENT_ACTION.fn(
      /** @type {EitherCLIOrLibdragonInfo} */ (info)
    );
    // This type make sure a similar restriction to this code block is enforced
    // without adding unnecessary javascript.
    // return isProjectAction(info)
    //   ? info.options.CURRENT_ACTION.fn(info)
    //   : info.options.CURRENT_ACTION.fn(info);
  })
  .catch((e) => {
    if (e instanceof ParameterError) {
      log(chalk.red(e.message));
      process.exit(STATUS_BAD_PARAM);
    }
    if (e instanceof ValidationError) {
      log(chalk.red(e.message));
      process.exit(STATUS_VALIDATION_ERROR);
    }

    const userTargetedError = e instanceof CommandError && e.userCommand;

    // Show additional information to user if verbose or we did a mistake
    if (globals.verbose || !userTargetedError) {
      log(chalk.red(globals.verbose ? e.stack : e.message));
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
  // Everything was done, update the configuration file if not exiting early
  .then(writeProjectInfo)
  .finally(() => {
    log(`Took: ${process.uptime()}s`, true);
    process.exit(STATUS_OK);
  });

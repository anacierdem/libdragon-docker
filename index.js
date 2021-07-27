#!/usr/bin/env node

const chalk = require('chalk');
const path = require('path');
const { options } = require('./modules/options');
const actions = require('./modules/actions');

process.argv.forEach(function (val, index) {
  if (index < 2) {
    return;
  }

  if (val.indexOf('--mount-path=') === 0) {
    options.MOUNT_PATH = path.join(
      process.cwd(),
      val.split('--mount-path=')[1]
    );
    return;
  }

  if (val === '--byte-swap') {
    options.BYTE_SWAP = true;
    return;
  }

  if (val === '--help') {
    console.log('Available actions:');
    Object.keys(actions).forEach((val) => {
      console.log(val);
    });
    process.exit(0);
  }

  const functionToRun = actions[val];
  if (typeof functionToRun === 'function') {
    const params = process.argv.slice(index + 1);
    functionToRun(params)
      .then((r) => {
        process.exit(0);
      })
      .catch((e) => {
        process.stderr.write(chalk.red(e.message + '\n'));
        process.exit(e.code || 1);
      });
  }
});

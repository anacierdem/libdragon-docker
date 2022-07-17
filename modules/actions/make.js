const { fn: exec } = require('./exec');

/**
 * @param {import('../project-info').LibdragonInfo} info
 */
const make = async (info) => {
  return await exec({
    ...info,
    options: {
      ...info.options,
      EXTRA_PARAMS: ['make', ...info.options.EXTRA_PARAMS],
    },
  });
};

module.exports = /** @type {const} */ ({
  name: 'make',
  fn: make,
  forwardsRestParams: true,
  usage: {
    name: 'make [params]',
    summary: 'Run the libdragon build system in the current directory.',
    description: `Runs the libdragon build system in the current directory. It will mirror your current working directory to the container.

    Must be run in an initialized libdragon project. This action is a shortcut to the \`exec\` action under the hood.`,
  },
});

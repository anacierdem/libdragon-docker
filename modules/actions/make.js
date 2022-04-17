const { fn: exec } = require('./exec');

const make = async (info) => {
  return await exec({
    ...info,
    options: {
      ...info.options,
      EXTRA_PARAMS: ['make', ...info.options.EXTRA_PARAMS],
    },
  });
};

module.exports = {
  name: 'make',
  fn: make,
  forwardsRestParams: true,
  usage: {
    name: 'make [params]',
    summary: 'Run the libdragon build system in the current directory.',
    description: `Runs the libdragon build system in the current directory. It will mirror your current working directory to the container.

    Must be run in an initialized libdragon project. This action is a shortcut to the \`exec\` action under the hood.`,
  },
};

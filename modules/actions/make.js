const { fn: exec } = require('./exec');

const make = async (libdragonInfo, params) => {
  return await exec(libdragonInfo, ['make', ...params]);
};

module.exports = {
  name: 'make',
  fn: make,
  forwardsRestParams: true,
  showStatus: true,
  usage: {
    name: 'make [params]',
    summary: 'Run the libdragon build system in the current directory.',
    description: `Runs the libdragon build system in the current directory. It will mirror your current working directory to the container.

    Must be run in an initialized libdragon project. This action is a shortcut to the \`exec\` action under the hood.`,
  },
};

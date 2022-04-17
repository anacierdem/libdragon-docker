const chalk = require('chalk');
const commandLineUsage = require('command-line-usage');

const { print } = require('../helpers');

const printUsage = (info) => {
  const actions = require('./');
  const globalOptionDefinitions = [
    {
      name: 'verbose',
      description:
        'Be verbose. This will print all commands dispatched and their outputs as well. Will also start printing error stack traces.',
      alias: 'v',
      typeLabel: ' ',
    },
  ];

  const optionDefinitions = [
    {
      name: 'image',
      description:
        'Use this flag to provide a custom image to use instead of the default. It should include the toolchain at `/n64_toolchain`. It will cause a re-initialization of the container if a different image is provided.\n',
      alias: 'i',
      typeLabel: '<docker-image>',
      group: 'docker',
    },
    {
      name: 'directory',
      description: `Directory where libdragon files are expected. It must be inside the libdragon project as it will be mounted on the docker container. The cli will create and manage it when using a non-manual strategy. Defaults to \`./libdragon\` if not provided.\n`,
      alias: 'd',
      typeLabel: '<path>',
      group: 'vendoring',
    },
    {
      name: 'strategy',
      description: `libdragon Vendoring strategy. Defaults to \`submodule\`, which safely creates a git repository at project root and a submodule at \`--directory\` to automatically update the vendored libdragon files.

        With \`subtree\`, the cli will create a subtree at \`--directory\` instead. Keep in mind that git user name and email must be set up for this to work. Do not use if you are not using git yourself.

        To disable auto-vendoring, init with \`manual\`. With \`manual\`, libdragon files are expected at the location provided by \`--directory\` flag and the user is responsible for vendoring and updating them. This will allow using any other manual vendoring method.

        You can always switch to manual by re-running \`init\` with \`--strategy manual\`, though you will be responsible for managing the existing submodule/subtree. Also it is not possible to automatically switch back.

        With the \`manual\` strategy, it is still recommended to have a git repository at project root such that container actions can execute faster by caching the container id inside the \`.git\` folder.\n`,
      alias: 's',
      typeLabel: '<strategy>',
      group: 'vendoring',
    },
  ];

  const actionsToShow =
    info?.options.EXTRA_PARAMS?.filter(
      (action) =>
        Object.keys(actions).includes(action) && !['help'].includes(action)
    ) ?? (info ? [info.options.CURRENT_ACTION.name] : []);

  const sections = [
    {
      header: chalk.green('Usage:'),
      content: `libdragon [flags] <action>

      For string flags valid syntax are: \`-i <value>\` or \`--image=<value>\``,
    },
    ...(actionsToShow?.length
      ? actionsToShow.flatMap((action) => [
          {
            header: chalk.green(`${action} action:`),
            content: actions[action].usage.description,
          },
          actions[action].usage.group || actions[action].usage.optionList
            ? {
                header: `accepted flags:`,
                optionList: [
                  ...(actions[action].usage.group ? optionDefinitions : []),
                  ...(actions[action].usage.optionList ?? []),
                ],
                group: actions[action].usage.group,
              }
            : {},
        ])
      : [
          {
            header: chalk.green('Available Commands:'),
            content: Object.values(actions).map(({ usage }) => ({
              name: usage.name,
              summary: usage.summary,
            })),
          },
        ]),
    {
      header: chalk.green('Global flags:'),
      optionList: globalOptionDefinitions,
    },
  ];
  const usage = commandLineUsage(sections);
  print(usage);
};

module.exports = {
  name: 'help',
  fn: printUsage,
  forwardsRestParams: true,
  mustHaveProject: false,
  usage: {
    name: 'help [action]',
    summary: 'Display this help information or details for the given action.',
  },
};

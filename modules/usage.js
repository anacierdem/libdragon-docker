const chalk = require('chalk');
const commandLineUsage = require('command-line-usage');

const { log } = require('./helpers');

const printUsage = (_, actionArr) => {
  const globalOptionDefinitions = [
    {
      name: 'verbose',
      description: 'Be verbose',
      alias: 'v',
      type: Boolean,
      group: 'global',
    },
  ];

  const optionDefinitions = [
    {
      name: 'image',
      description: 'Provide a custom image.',
      alias: 'i',
      type: String,
      typeLabel: '<docker-image>',
      group: 'docker',
    },
  ];

  const actions = {
    help: {
      name: 'help [action]',
      summary: 'Display this help information or details for the given action.',
    },
    init: {
      name: 'init',
      summary: 'Create a libdragon project in the current directory.',
      description: `Creates a libdragon project in the current directory. Every libdragon project will have its own docker container instance. If you are in a git repository or an NPM project, libdragon will be initialized at their root also marking there with a \`.libdragon\` folder.

      A git repository and a submodule at \`./libdragon\` will also be created. Do not remove the \`.libdragon\` folder and commit its contents if you are using git, as it keeps persistent libdragon project information.

      If this is the first time you are creating a libdragon project at that location, this action will also create skeleton project files to kickstart things.`,
      group: ['docker'],
    },
    make: {
      name: 'make [params]',
      summary: 'Run the libdragon build system in the current directory.',
      description: `Runs the libdragon build system in the current directory. It will mirror your current working directory to the container.

      This action is a shortcut to the \`exec\` action under the hood.`,
    },
    exec: {
      name: 'exec <command>',
      summary: 'Execute given command in the current directory.',
      description: `Executes the given command in the container passing down any arguments provided. If you change your host working directory, the command will be executed in the corresponding folder in the container as well.

      This action will first try to execute the command in the container and if the container is not accessible, it will attempt a complete \`start\` cycle.

      This will properly passthrough your TTY if you have one. So by running \`libdragon exec bash\` you can start an interactive bash session with full TTY support.`,
    },
    start: {
      name: 'start',
      summary: 'Start the container for current project.',
      description:
        'Start the container assigned to the current libdragon project. Will first attempt to start an existing container if found, followed by a new container run and installation similar to the `install` action. Will always print out the container id on success.',
    },
    name: {
      name: 'stop',
      summary: 'Stop the container for current project.',
      description:
        'Stop the container assigned to the current libdragon project.',
    },
    install: {
      name: 'install',
      summary: 'Vendor libdragon as is.',
      group: ['docker'],
      description:
        'Attempts to build and install everything libdragon related into the container. This includes all the tools and third parties used by libdragon except for the toolchain. If you have made changes to libdragon, you can execute this action to build everything based on your changes. Requires you to have an intact `libdragon` at the root of the project. If you are not working on libdragon, you can just use the `update` action instead.',
    },
    update: {
      name: 'update',
      summary: 'Update libdragon and do an install.',
      description:
        'This action will update the submodule from the remote branch (`trunk`) with a merge strategy and then perform a `libdragon install`. You can use the `install` action to only update all libdragon related artifacts in the container.',
      group: ['docker'],
    },
  };

  const actionsToShow = actionArr
    ?.filter((action) => Object.keys(actions).includes(action))
    .filter((action) => !['help'].includes(action));

  const sections = [
    {
      header: chalk.green('Usage:'),
      content: 'libdragon [flags] <action>',
    },
    ...(actionsToShow?.length
      ? actionsToShow.flatMap((action) => [
          {
            header: chalk.green(`${action} action:`),
            content: actions[action].description,
          },
          actions[action].group
            ? {
                header: `accepted flags:`,
                optionList: optionDefinitions,
                group: actions[action].group,
              }
            : {},
        ])
      : [
          {
            header: chalk.green('Available Commands:'),
            content: Object.values(actions).map((action) => ({
              name: action.name,
              summary: action.summary,
            })),
          },
        ]),
    {
      header: chalk.green('Global flags:'),
      optionList: globalOptionDefinitions,
    },
  ];
  const usage = commandLineUsage(sections);
  log(usage);
};

module.exports = {
  printUsage,
};

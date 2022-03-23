const chalk = require('chalk');
const commandLineUsage = require('command-line-usage');

const { log } = require('../helpers');

const printUsage = (_, actionArr) => {
  const globalOptionDefinitions = [
    {
      name: 'verbose',
      description:
        'Be verbose. This will print all commands dispatched and their outputs as well. Will also start printing error stack traces.',
      alias: 'v',
      typeLabel: ' ',
      group: 'global',
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
      description: `Directory where libdragon files are expected. It must be a project relative path as it will be mounted on the docker container. The cli will create and manage it when using a non-manual strategy. Defaults to \`./libdragon\` if not provided.\n`,
      alias: 'd',
      typeLabel: '<path>',
      group: 'vendoring',
    },
    {
      name: 'strategy',
      description: `libdragon Vendoring strategy. Defaults to \`submodule\`, which safely creates a git repository at project root and a submodule at \`--directory\` to automatically update the vendored libdragon files.

        With \`subtree\`, the cli will create a subtree at \`--directory\` instead. Keep in mind that git user name and email must be set up for this to work. Do not use if you are not using git yourself.

        To disable auto-vendoring, init with \`manual\`. With \`manual\`, libdragon files are expected at the location provided by \`--directory\` flag and the user is responsible for vendoring and updating them. This will allow using any other manual vendoring method.

        With the \`manual\` strategy, it is still recommended to have a git repository at project root such that container actions can execute faster by caching the container id inside the \`.git\` folder.

        It is also possible to opt-out later on by running \`init\` with \`--strategy manual\`, though you will be responsible for managing the existing submodule/subtree.\n`,
      alias: 'v',
      typeLabel: '<strategy>',
      group: 'vendoring',
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
      description: `Creates a libdragon project in the current directory. Every libdragon project will have its own docker container instance. If you are in a git repository or an NPM project, libdragon will be initialized at their root also marking there with a \`.libdragon\` folder. Do not remove the \`.libdragon\` folder and commit its contents if you are using source control, as it keeps persistent libdragon project information.

      By default, a git repository and a submodule at \`./libdragon\` will be created to automatically update the vendored libdragon files on subsequent \`update\`s. If you intend to opt-out from this feature, see the \`--strategy manual\` flag to provide your self-managed libdragon copy. The default behaviour is intended for users who primarily want to consume libdragon as is.

      If this is the first time you are creating a libdragon project at that location, this action will also create skeleton project files to kickstart things with the given image, if provided. For subsequent runs, it will act like \`start\` thus can be used to revive an existing project without modifying it.`,
      group: ['docker', 'vendoring'],
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
      description: `Attempts to build and install everything libdragon related into the container. This includes all the tools and third parties used by libdragon except for the toolchain. If you have made changes to libdragon, you can execute this action to build everything based on your changes. Requires you to have an intact vendoring target (also see the \`--directory\` flag). If you are not working on libdragon itself, you can just use the \`update\` action instead.

        This can be useful to recover from a half-baked container.`,
    },
    update: {
      name: 'update',
      summary: 'Update libdragon and do an install.',
      description:
        'If you are using auto-vendoring (see `--strategy`), this action will update the submodule/subtree from the remote branch (`trunk`) with a merge/squash strategy and then perform a `libdragon install`. This is the same as an `install` when the vendoring strategy is `manual`. You can use the `install` action to only update all libdragon related artifacts in the container.',
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
  name: 'help',
  fn: printUsage,
  showStatus: true,
  forwardsRestParams: true,
};

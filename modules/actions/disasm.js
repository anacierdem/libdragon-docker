const path = require('path');
const fs = require('fs/promises');

const { fn: exec } = require('./exec');
const {
  ValidationError,
  toPosixPath,
  dirExists,
  fileExists,
  ParameterError,
} = require('../helpers');

/**
 * @param {string} stop
 * @param {string} start
 * @returns {Promise<string>}
 */
const findElf = async (stop, start = '.') => {
  start = path.resolve(start);

  const files = await fs.readdir(start);

  const buildDir = path.join(start, 'build');
  if (await dirExists(buildDir)) {
    const elfFile = await findElf(buildDir, buildDir);
    if (elfFile) return elfFile;
  }

  const elfFiles = files.filter((name) => name.endsWith('.elf'));

  if (elfFiles.length > 1) {
    throw new ValidationError(
      `Multiple ELF files found in ${path.resolve(
        start
      )}. Use --file to specify.`
    );
  }

  if (elfFiles.length === 1) {
    return path.join(start, elfFiles[0]);
  }

  const parent = path.join(start, '..');
  if (start !== stop) {
    return await findElf(stop, parent);
  } else {
    throw new ValidationError(`No ELF files found. Use --file to specify.`);
  }
};

/**
 * @param {import('../project-info').LibdragonInfo} info
 */
const disasm = async (info) => {
  let elfPath;
  if (info.options.FILE) {
    if (path.relative(info.root, info.options.FILE).startsWith('..')) {
      throw new ParameterError(
        `Provided file ${info.options.FILE} is outside the project directory.`,
        info.options.CURRENT_ACTION.name
      );
    }
    if (!(await fileExists(info.options.FILE)))
      throw new ParameterError(
        `Provided file ${info.options.FILE} does not exist`,
        info.options.CURRENT_ACTION.name
      );
    elfPath = info.options.FILE;
  }
  elfPath = elfPath ?? (await findElf(info.root));

  const haveSymbol =
    info.options.EXTRA_PARAMS.length > 0 &&
    !info.options.EXTRA_PARAMS[0].startsWith('-');

  const finalArgs = haveSymbol
    ? [
        `--disassemble=${info.options.EXTRA_PARAMS[0]}`,
        ...info.options.EXTRA_PARAMS.slice(1),
      ]
    : info.options.EXTRA_PARAMS;

  const intermixSourceParams =
    info.options.EXTRA_PARAMS.length === 0 || haveSymbol ? ['-S'] : [];

  return await exec({
    ...info,
    options: {
      ...info.options,
      EXTRA_PARAMS: [
        'mips64-elf-objdump',
        ...finalArgs,
        ...intermixSourceParams,
        toPosixPath(path.relative(process.cwd(), elfPath)),
      ],
    },
  });
};

module.exports = /** @type {const} */ ({
  name: 'disasm',
  fn: disasm,
  forwardsRestParams: true,
  usage: {
    name: 'disasm [symbol|flags]',
    summary: 'Disassemble the nearest *.elf file.',
    description: `Executes \`objdump\` for the nearest *.elf file starting from the working directory, going up. If there is a \`build\` directory in the searched paths, checks inside it as well. Any extra flags are passed down to \`objdump\` before the filename.

    If a symbol name is provided after the action, it is converted to \`--disassembly=<symbol>\` and intermixed source* (\`-S\`) is automatically applied. This allows disassembling a single symbol by running;

    \`libdragon disasm main\`

    Again, any following flags are forwarded down. If run without extra symbol/flags, disassembles whole ELF with \`-S\` by default.

    Must be run in an initialized libdragon project.

    * Note that to be able to see the source, the code must be built with \`D=1\``,

    optionList: [
      {
        name: 'file',
        description:
          'Provide a specific ELF file relative to current working directory and inside the libdragon project.',
        alias: 'f',
        typeLabel: ' ',
      },
    ],
  },
});

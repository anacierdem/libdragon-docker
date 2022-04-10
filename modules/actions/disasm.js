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

const disasm = async (libdragonInfo, extraArgs) => {
  let elfPath;
  if (libdragonInfo.options.FILE) {
    if (
      path
        .relative(libdragonInfo.root, libdragonInfo.options.FILE)
        .startsWith('..')
    ) {
      throw new ParameterError(
        `Provided file ${libdragonInfo.options.FILE} is outside the project directory.`
      );
    }
    if (!(await fileExists(libdragonInfo.options.FILE)))
      throw new ParameterError(
        `Provided file ${libdragonInfo.options.FILE} does not exist`
      );
    elfPath = libdragonInfo.options.FILE;
  }
  elfPath = elfPath ?? (await findElf(libdragonInfo.root));

  const haveSymbol = extraArgs.length > 0 && !extraArgs[0].startsWith('-');

  const finalArgs = haveSymbol
    ? [`--disassemble=${extraArgs[0]}`, ...extraArgs.slice(1)]
    : extraArgs;

  const intermixSourceParams =
    extraArgs.length === 0 || haveSymbol ? ['-S'] : [];

  return await exec(libdragonInfo, [
    'mips64-elf-objdump',
    ...finalArgs,
    ...intermixSourceParams,
    toPosixPath(path.relative(process.cwd(), elfPath)),
  ]);
};

module.exports = {
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
};

// TODO: enable type checking for this file.
// import '@jest/globals';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import 'zx/globals';

/* eslint-disable no-undef */

if (process.platform === 'win32') {
  // ADDITONAL Windows weirdness: docker is not found in the PATH when running
  // tests. I fixed this by moving the docker bin path to one up in the list.
  // Either there is a limit on path with this jest+zx setup or something else
  // was messing with the path. The other path was:
  // C:\Program Files (x86)\Windows Kits\10\Windows Performance Toolkit\
  // and it is definitely not the only one with spaces in it.

  // Default to cmd.exe on windows. o/w zx will try to use wsl etc. which the
  // user may not have node installed. Theorerically, we could use the node from
  // the wsl container but if it is on the host system you'd need to include the
  // extension like node.exe
  // The reason why I don't use powershell is because it does not support the `--`
  // syntax for passing arguments to the script due to a bug? in npm.ps1 that gets
  // installed locally via @semantic-release. It is introduced in node_modules\.bin
  // and that path is added to the child process' PATH causing it to take precedence
  // on powershell. Also see https://github.com/npm/cli/issues/3136
  $.shell = true;
  // Defaults to "set -euo pipefail;" o/w
  $.prefix = '';
}

let repositoryDir;
beforeAll(async () => {
  repositoryDir = process.cwd();

  // Make sure the cli is linked
  await $`npm link`;
  // Inside the project, the local cli is also inserted into the path
  // so we need to link it as well
  await $`npm link libdragon`;
}, 60000);

let projectDir;
let lastCommand;
let stopped = false;
afterEach(async () => {
  // Stop further execution before giving control to the continuation.
  stopped = true;
  // Wait until dead, then the next iteration will not happen as we `stopped` it.
  // This is only necessary for the timeout condition
  try {
    await lastCommand?.kill();
  } catch {
    // ignore
  }
  try {
    await $`libdragon --verbose destroy`;
  } catch (e) {
    // ignore
  }
  try {
    await fsp.rm(projectDir, {
      recursive: true,
      maxRetries: 3,
      retryDelay: 1000,
    });
  } catch (e) {
    // ignore
  }
  lastCommand = undefined;
}, 60000);

beforeEach(async () => {
  stopped = false;

  // Windows' tmpdir returns a short path which is not compatible when doing one
  // of the internal comparisons in the libdragon cli. So we use the parent
  // directory instead.
  const tmpDir =
    process.platform === 'win32' ? path.join(repositoryDir, '..') : os.tmpdir();
  projectDir = await fsp.mkdtemp(path.join(tmpDir, 'libdragon-test-project-'));

  await cd(projectDir);
});

const runCommands = async (commands, beforeCommand) => {
  console.log('NEW COMMAND SEQUENCE');
  for (const command of commands) {
    await beforeCommand?.();
    // Do not invoke it as a tagged template literal. This will cause a parameter
    // replacement, which we don't want here.
    console.log('TEST STEP: libdragon -v', command);
    lastCommand = $([`libdragon -v ${command}`]);
    await lastCommand;
    if (stopped) break;
  }
};

describe('Smoke tests', () => {
  // A set of commands that should not fail when run in sequence.
  const commands = [
    'make',
    'exec ls',
    'stop',
    'start',
    'update',
    'install',
    '--file=./build/hello.elf disasm main',
    'destroy',
    'help',
    'version',
  ];

  test('Can run a standard set of commands without failure', async () => {
    await runCommands(['init', 'init', ...commands, 'init -s submodule']);
  }, 240000);

  // test('Can run a standard set of commands even if the container id is lost', async () => {
  //   await runCommands(
  //     ['init', 'init', ...commands, 'init -s submodule'],
  //     async () => {
  //       try {
  //         await fsp.rm('.git/libdragon-docker-container');
  //       } catch {
  //         // ignore
  //       }
  //     }
  //   );
  // }, 240000);

  test('Can run a standard set of commands with subtree strategy', async () => {
    await runCommands([
      'init -s subtree -d ./libdragon',
      'init -s subtree -d ./libdragon',
      ...commands,
      'init -s subtree -d ./libdragon',
    ]);
  }, 240000);

  // TODO: this will fail if the image is not compatible with the local libdragon
  test('Can run a standard set of commands with a manual libdragon vendor', async () => {
    // Copy the libdragon files to the project directory with a non-standard name
    await fsp.cp(path.join(repositoryDir, 'libdragon'), './libdragon_test', {
      recursive: true,
    });

    await runCommands([
      'init -s manual -d ./libdragon_test',
      'init -s manual -d ./libdragon_test',
      ...commands,
      'init -s manual -d ./libdragon_test',
    ]);
  }, 240000);

  test('should not start a new docker container on a second init', async () => {
    await $`libdragon init`;
    const { stdout: containerId } = await $`libdragon start`;
    // Ideally this second init should not re-install libdragon file if they exist
    await $`libdragon init`;
    // TODO: Actually this should hold even when the actual image is different
    expect((await $`libdragon start`).stdout.trim()).toEqual(
      containerId.trim()
    );
  }, 200000);

  // TODO: find a better way to test such stuff. Integration is good but makes
  // these really difficult to test. Or maybe we can have a flag to skip the build
  // step
  test('should update only the image when --image flag is present', async () => {
    await $`libdragon init`;
    const { stdout: containerId } = await $`libdragon start`;
    const { stdout: image } =
      await $`docker container inspect ${containerId.trim()} --format "{{.Config.Image}}"`;
    const { stdout: branch } =
      await $`git -C ./libdragon rev-parse --abbrev-ref HEAD`;

    expect(branch.trim()).toEqual('trunk');
    expect(image.trim()).toEqual('ghcr.io/dragonminded/libdragon:latest');

    await $`libdragon init --image="ghcr.io/dragonminded/libdragon:unstable"`;
    const { stdout: newContainerId } = await $`libdragon start`;
    const { stdout: newBranch } =
      await $`git -C ./libdragon rev-parse --abbrev-ref HEAD`;

    expect(newBranch.trim()).toEqual('trunk');

    expect(newContainerId.trim()).not.toEqual(containerId);
    expect(
      (
        await $`docker container inspect ${newContainerId.trim()} --format "{{.Config.Image}}"`
      ).stdout.trim()
    ).toBe('ghcr.io/dragonminded/libdragon:unstable');
  }, 200000);

  test('should use the provided branch', async () => {
    await $`libdragon init --branch=unstable`;
    const { stdout: branch } =
      await $`git -C ./libdragon rev-parse --abbrev-ref HEAD`;

    expect(branch.trim()).toEqual('unstable');
  }, 120000);

  test('should recover the submodule branch after a destroy', async () => {
    await $`libdragon init --branch=unstable`;
    await $`libdragon destroy`;
    await $`libdragon init`;
    const { stdout: newContainerId } = await $`libdragon start`;
    const { stdout: branch } =
      await $`git -C ./libdragon rev-parse --abbrev-ref HEAD`;

    expect(
      (
        await $`docker container inspect ${newContainerId.trim()} --format "{{.Config.Image}}"`
      ).stdout.trim()
    ).toBe('ghcr.io/dragonminded/libdragon:unstable');

    expect(branch.trim()).toEqual('unstable');
  }, 200000);
});

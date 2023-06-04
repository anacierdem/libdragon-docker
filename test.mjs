// TODO: enable type checking for this file.
// import '@jest/globals';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import 'zx/globals';

import ref from 'ref-napi';
import ffi from 'ffi-napi';

/* eslint-disable no-undef */

let kernel32;
if (process.platform === 'win32') {
  // Default to cmd.exe on windows. o/w zx will try to use wsl etc. which the
  // user may not have node installed. Theorerically, we could use the node from
  // the wsl container but if it is on the host system you'd need to include the
  // extension like node.exe
  // The reason why I don't use powershell is because it does not support the `--`
  // syntax for passing arguments to the script due to a bug? in npm.ps1 that gets
  // installed locally via @semantic-release. It is introduced in node_modules\.bin
  // and that path is added to the child process' PATH causing it to take precedence
  // on powershell. Also see https://github.com/npm/cli/issues/3136
  $.shell = 'cmd.exe';
  $.prefix = '';

  // Prepare the ffi bindings for GetLongPathNameA
  const DWORD = ref.types.ulong;
  kernel32 = ffi.Library('kernel32', {
    // DWORD GetLongPathNameA(
    //   [in]  LPCSTR lpszShortPath,
    //   [out] LPSTR  lpszLongPath,
    //   [in]  DWORD  cchBuffer
    // );
    GetLongPathNameA: [DWORD, [ref.types.CString, ref.types.CString, DWORD]],
  });
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

  projectDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'libdragon-test-project-')
  );

  // tmpdir creates a short path on Windows, convert it to long form to be
  // compatible with the other paths that we use for relative comparison
  if (kernel32) {
    const bufferSize = 260; // MAX_PATH as defined by windows incl. null terminator
    const longPath = ref.allocCString(new Array(bufferSize + 1).join(' '));
    const written = kernel32.GetLongPathNameA(projectDir, longPath, bufferSize);

    // written bytes should be less than bufferSize as there will also be an
    // additional terminating null character
    if (written >= bufferSize) {
      throw new Error('Path too long.');
    }

    projectDir = ref.readCString(longPath);
  }

  await cd(projectDir);
});

const runCommands = async (commands, beforeCommand) => {
  for (const command of commands) {
    await beforeCommand?.();
    // Do not invoke it as a tagged template literal. This will cause a parameter
    // replacement, which we don't want here.
    lastCommand = $([`libdragon  ${command}`]);
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

  test('Can run a standard set of commands even if the container id is lost', async () => {
    await runCommands(
      ['init', 'init', ...commands, 'init -s submodule'],
      async () => {
        try {
          await fsp.rm('.git/libdragon-docker-container');
        } catch {
          // ignore
        }
      }
    );
  }, 240000);

  test('Can run a standard set of commands with subtree strategy', async () => {
    await runCommands([
      'init -s subtree -d ./libdragon',
      'init -s subtree -d ./libdragon',
      ...commands,
      'init -s subtree -d ./libdragon',
    ]);
  }, 240000);

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
});

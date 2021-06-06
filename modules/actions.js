const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const {
  BASE_IMAGE_VERSION,
  DOCKER_HUB_NAME,
  IS_CI,
  IMAGE_VERSION,
  SELF_BUILD,
  PROJECT_NAME,
} = require('./constants');
const { options } = require('./options');
const { runCommand, spawnProcess } = require('./helpers');

async function startToolchain() {
  // Do not try to run docker if already in container
  if (process.env.IS_DOCKER === 'true') {
    return;
  }

  const containerID = (
    await spawnProcess('docker', [
      'container',
      'ls',
      '-qa',
      '-f',
      'name=^/' + PROJECT_NAME + '$',
    ])
  ).trim();

  if (containerID) {
    await spawnProcess('docker', ['container', 'rm', '-f', containerID], true);
  }

  await spawnProcess(
    'docker',
    [
      'run',
      '--name=' + PROJECT_NAME,
      ...(options.BYTE_SWAP ? ['-e', 'N64_BYTE_SWAP=true'] : []),
      '-e',
      'IS_DOCKER=true',
      '-d', // Detached
      '--mount',
      'type=bind,source=' + options.MOUNT_PATH + ',target=/' + PROJECT_NAME, // Mount files
      '-w=/' + PROJECT_NAME, // Set working directory
      DOCKER_HUB_NAME + ':' + IMAGE_VERSION,
      'tail',
      '-f',
      '/dev/null',
    ],
    true
  );
}

async function make(params) {
  // Do not try to run docker if already in container
  if (process.env.IS_DOCKER === 'true') {
    await spawnProcess('make', params, true);
    return;
  }
  await spawnProcess('docker', ['exec', PROJECT_NAME, 'make', ...params], true);
}

async function download() {
  // Do not try to run docker if already in container
  if (process.env.IS_DOCKER === 'true') {
    return;
  }
  await spawnProcess(
    'docker',
    ['pull', DOCKER_HUB_NAME + ':' + BASE_IMAGE_VERSION],
    true
  );

  // Use only base version on CI
  if (!SELF_BUILD) {
    await spawnProcess(
      'docker',
      ['pull', DOCKER_HUB_NAME + ':' + IMAGE_VERSION],
      true
    );
  }
}

async function stop() {
  // Do not try to run docker if already in container
  if (process.env.IS_DOCKER === 'true') {
    return;
  }
  const list = await spawnProcess('docker', [
    'ps',
    '-aq',
    '-f name=^/' + PROJECT_NAME + '$',
  ]);
  if (list) {
    await spawnProcess('docker', ['rm', '-f', PROJECT_NAME], true);
  }
}

async function buildDragon() {
  await spawnProcess(
    'docker',
    [
      'build',
      '--build-arg',
      'DOCKER_HUB_NAME=' + DOCKER_HUB_NAME,
      '--build-arg',
      'BASE_VERSION=' + BASE_IMAGE_VERSION,
      '-t',
      DOCKER_HUB_NAME + ':' + IMAGE_VERSION,
      '-f',
      './dragon.Dockerfile',
      './',
    ],
    true
  );
  // Start freshly built image
  await startToolchain();
}

async function installDependencies() {
  const { dependencies } = require(path.join(process.cwd() + '/package.json'));

  const { devDependencies } = require(path.join(
    process.cwd() + '/package.json'
  ));

  const deps = await Promise.all(
    Object.keys({
      ...dependencies,
      ...devDependencies,
    })
      .filter((dep) => dep !== 'libdragon')
      .map(async (dep) => {
        const npmPath = await runCommand('npm ls ' + dep + ' --parseable=true');
        return {
          name: dep,
          paths: _.uniq(npmPath.split('\n').filter((f) => f)),
        };
      })
  );

  await Promise.all(
    deps.map(({ paths }) => {
      if (paths.length > 1) {
        return Promise.reject(
          'Using same dependency with different versions is not supported!'
        );
      }
      return new Promise((resolve, reject) => {
        fs.access(path.join(paths[0], 'Makefile'), fs.F_OK, async (e) => {
          if (e) {
            // File does not exist - skip
            resolve();
            return;
          }

          try {
            const relativePath = path
              .relative(options.MOUNT_PATH, paths[0])
              .replace(new RegExp('\\' + path.sep), path.posix.sep);
            const containerPath = path.posix.join(
              '/',
              PROJECT_NAME,
              relativePath,
              '/'
            );
            const makePath = path.posix.join(containerPath, 'Makefile');

            // Do not try to run docker if already in container
            if (process.env.IS_DOCKER === 'true') {
              await runCommand(
                '[ -f ' +
                  makePath +
                  ' ] && make -C ' +
                  containerPath +
                  ' && make -C ' +
                  containerPath +
                  ' install'
              );
            } else {
              await spawnProcess(
                'docker',
                [
                  'exec',
                  PROJECT_NAME,
                  '/bin/bash',
                  '-c',
                  '[ -f ' +
                    makePath +
                    ' ] && make -C ' +
                    containerPath +
                    ' && make -C ' +
                    containerPath +
                    ' install',
                ],
                true
              );
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    })
  );
}

module.exports = {
  start: startToolchain,
  download: download,
  init: async function initialize() {
    // Do not try to run docker if already in container
    if (process.env.IS_DOCKER === 'true') {
      return;
    }

    // Build toolchain
    await spawnProcess(
      'docker',
      ['build', '-t', DOCKER_HUB_NAME + ':' + BASE_IMAGE_VERSION, './'],
      true
    );

    // Build and install libdragon
    await buildDragon();
  },
  installDependencies: installDependencies,
  install: async function install() {
    await download();
    await startToolchain();
    await installDependencies();
  },
  make: make,
  stop: stop,
  buildDragon: buildDragon,
  // This requires docker login
  update: async function update() {
    // Do not try to run docker if already in container
    if (process.env.IS_DOCKER === 'true') {
      return;
    }
    await stop();
    // We assume buildDragon was run.
    await spawnProcess(
      'docker',
      ['push', DOCKER_HUB_NAME + ':' + IMAGE_VERSION],
      true
    );

    if (IS_CI) {
      await spawnProcess(
        'docker',
        [
          'tag',
          DOCKER_HUB_NAME + ':' + IMAGE_VERSION,
          DOCKER_HUB_NAME + ':latest',
        ],
        true
      );

      await spawnProcess('docker', ['push', DOCKER_HUB_NAME + ':latest'], true);
    }
  },
};

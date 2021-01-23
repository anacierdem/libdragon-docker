const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { BASE_VERSION, DOCKER_HUB_NAME, UPDATE_LATEST } = require('./constants');
const { options } = require('./options');
const { runCommand, spawnProcess } = require('./helpers');
const { version: selfVersion } = require('../package.json'); // Always use self version for docker image

async function startToolchain(forceLatest = false) {
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
      'name=^/' + options.PROJECT_NAME + '$',
    ])
  ).trim();

  if (containerID) {
    await spawnProcess('docker', ['container', 'rm', '-f', containerID], true);
  }

  await spawnProcess(
    'docker',
    [
      'run',
      '--name=' + options.PROJECT_NAME,
      ...(options.BYTE_SWAP ? ['-e', 'N64_BYTE_SWAP=true'] : []),
      '-e',
      'IS_DOCKER=true',
      '-d', // Detached
      '--mount',
      'type=bind,source=' +
        options.MOUNT_PATH +
        ',target=/' +
        options.PROJECT_NAME, // Mount files
      '-w=/' + options.PROJECT_NAME, // Set working directory
      DOCKER_HUB_NAME +
        ':' +
        (!forceLatest && options.SELF_BUILD ? BASE_VERSION : selfVersion),
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
  await spawnProcess(
    'docker',
    ['exec', options.PROJECT_NAME, 'make', ...params],
    true
  );
}

async function download() {
  // Do not try to run docker if already in container
  if (process.env.IS_DOCKER === 'true') {
    return;
  }
  await spawnProcess(
    'docker',
    ['pull', DOCKER_HUB_NAME + ':' + BASE_VERSION],
    true
  );

  // Use only base version on CI
  if (!options.SELF_BUILD) {
    await spawnProcess(
      'docker',
      ['pull', DOCKER_HUB_NAME + ':' + selfVersion],
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
    '-f name=^/' + options.PROJECT_NAME + '$',
  ]);
  if (list) {
    await spawnProcess('docker', ['rm', '-f', options.PROJECT_NAME], true);
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
      'BASE_VERSION=' + BASE_VERSION,
      '-t',
      DOCKER_HUB_NAME + ':' + selfVersion,
      '-f',
      './dragon.Dockerfile',
      './',
    ],
    true
  );
  // Start freshly built image
  await startToolchain(true);
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
              options.PROJECT_NAME,
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
                  options.PROJECT_NAME,
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
  start: () => startToolchain(true),
  download: download,
  init: async function initialize() {
    // Do not try to run docker if already in container
    if (process.env.IS_DOCKER === 'true') {
      return;
    }

    // Build toolchain
    await spawnProcess(
      'docker',
      ['build', '-t', DOCKER_HUB_NAME + ':' + BASE_VERSION, './'],
      true
    );

    // Build and install libdragon
    await buildDragon();
  },
  installDependencies: installDependencies,
  install: async function install() {
    await download();
    await startToolchain(true);
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
      ['push', DOCKER_HUB_NAME + ':' + selfVersion],
      true
    );

    if (UPDATE_LATEST) {
      await spawnProcess(
        'docker',
        [
          'tag',
          DOCKER_HUB_NAME + ':' + selfVersion,
          DOCKER_HUB_NAME + ':latest',
        ],
        true
      );

      await spawnProcess('docker', ['push', DOCKER_HUB_NAME + ':latest'], true);
    }
  },
};

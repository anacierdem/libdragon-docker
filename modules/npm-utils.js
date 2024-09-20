const path = require('path');
const fsClassic = require('fs');

const _ = require('lodash');

const { dockerHostUserParams } = require('./docker-utils');

const { CONTAINER_TARGET_PATH } = require('./constants');
const {
  fileExists,
  toPosixPath,
  spawnProcess,
  dockerExec,
  ValidationError,
} = require('./helpers');

async function findNPMRoot() {
  try {
    const root = path.resolve((await runNPM(['root'])).trim(), '..');
    // Only report if package.json really exists. npm fallbacks to cwd
    if (await fileExists(path.join(root, 'package.json'))) {
      return root;
    }
  } catch {
    // User does not have and does not care about NPM if it didn't work
    return undefined;
  }
}

/**
 * Install other NPM dependencies if this is an NPM project
 * @param {import('./project-info').LibdragonInfo} libdragonInfo
 */
const installNPMDependencies = async (libdragonInfo) => {
  const npmRoot = await findNPMRoot();
  if (npmRoot) {
    const packageJsonPath = path.join(npmRoot, 'package.json');

    const { dependencies, devDependencies } = require(packageJsonPath);

    const deps = await Promise.all(
      Object.keys({
        ...dependencies,
        ...devDependencies,
      })
        .filter((dep) => dep !== 'libdragon')
        .map(async (dep) => {
          const npmPath = await runNPM(['ls', dep, '--parseable=true']);
          return {
            name: dep,
            paths: _.uniq(npmPath.split('\n').filter((f) => f)),
          };
        })
    );

    await Promise.all(
      deps.map(({ name, paths }) => {
        return /** @type Promise<void> */ (
          new Promise((resolve, reject) => {
            fsClassic.access(
              path.join(paths[0], 'Makefile'),
              fsClassic.constants.F_OK,
              async (e) => {
                if (e) {
                  // File does not exist - skip
                  resolve();
                  return;
                }

                if (paths.length > 1) {
                  reject(
                    new ValidationError(
                      `Using same dependency with different versions is not supported! ${name}`
                    )
                  );
                  return;
                }

                try {
                  const relativePath = toPosixPath(
                    path.relative(libdragonInfo.root, paths[0])
                  );
                  const containerPath = path.posix.join(
                    CONTAINER_TARGET_PATH,
                    relativePath
                  );
                  const makePath = path.posix.join(containerPath, 'Makefile');

                  await dockerExec(
                    libdragonInfo,
                    [...dockerHostUserParams(libdragonInfo)],
                    [
                      '/bin/bash',
                      '-c',
                      '[ -f ' +
                        makePath +
                        ' ] && make -C ' +
                        containerPath +
                        ' && make -C ' +
                        containerPath +
                        ' install',
                    ]
                  );

                  resolve();
                } catch (e) {
                  reject(e);
                }
              }
            );
          })
        );
      })
    );
  }
};

/**
 * @param {string[]} params
 */
function runNPM(params) {
  return spawnProcess(
    /^win/.test(process.platform) ? 'npm.cmd' : 'npm',
    params,
    {
      userCommand: false,
      inheritStdin: true,
      inheritStdout: false,
      inheritStderr: false,
      spawnOptions: {
        shell: true,
      },
    }
  );
}
module.exports = {
  installNPMDependencies,
  findNPMRoot,
};

const path = require('path');
const { exec, spawn } = require('child_process');

// A simple Promise wrapper for child_process.exec
function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    const command = exec(cmd, {}, (err, stdout) => {
      if (err === null) {
        resolve(stdout);
      } else {
        reject(err);
      }
    });

    command.stdout.on('data', function (data) {
      process.stdout.write(data.toString());
    });

    command.stderr.on('data', function (data) {
      process.stderr.write(data.toString());
    });
  });
}

// A simple Promise wrapper for child_process.spawn
function spawnProcess(cmd, params = [], discardResult = false) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    const command = spawn(cmd, params);

    command.stdout.on('data', function (data) {
      process.stdout.write(data);
      if (!discardResult) {
        stdout += data;
      }
    });

    command.stderr.on('data', function (data) {
      process.stderr.write(data);
    });

    const errorHandler = (err) => {
      command.off('close', closeHandler);
      reject(err);
    };

    const closeHandler = function (code) {
      command.off('error', errorHandler);
      if (code === 0) {
        resolve(stdout);
      } else {
        const err = new Error(`Process exited with code ${code}`);
        err.code = code;
        reject(err);
      }
    };

    command.on('error', errorHandler);
    command.once('close', closeHandler);
  });
}

function toPosixPath(p) {
  return p.replace(new RegExp('\\' + path.sep), path.posix.sep);
}

module.exports = {
  runCommand: runCommand,
  spawnProcess: spawnProcess,
  toPosixPath: toPosixPath,
};

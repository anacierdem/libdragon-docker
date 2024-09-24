#!/usr/bin/env zx
import path from 'node:path';
import { copyFileSync } from 'node:fs';
import * as esbuild from 'esbuild';
import 'zx/globals';

if (process.platform === 'win32') {
  // See notes on test.mjs
  $.shell = true;
  $.prefix = '';
}

// TODO: Enable useSnapshot for a faster startup in the future

let executableName = 'libdragon';
if (process.platform === 'win32') {
  executableName = 'libdragon.exe';
} else if (process.platform === 'darwin') {
  executableName = 'libdragon-macos';
} else if (process.platform === 'linux') {
  executableName = 'libdragon-linux';
}

const executablePath = path.join('build', executableName);

await esbuild.build({
  entryPoints: ['index.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: path.join('build', 'main.js'),
  minify: true,
  loader: {
    '.c': 'text',
    '.mk': 'text',
  },
  define: {
    PACKAGED: 'sea',
  },
});

await $`node --experimental-sea-config sea-config.json`;

copyFileSync(process.execPath, executablePath);

if (process.platform === 'win32') {
  await $`signtool remove /s ${executablePath}`.nothrow();
} else if (process.platform === 'darwin') {
  await $`codesign --remove-signature ${executablePath}`.nothrow();
}

await $([
  `npx postject ${executablePath} NODE_SEA_BLOB ${path.join(
    'build',
    'sea-prep.blob'
  )} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`,
]);

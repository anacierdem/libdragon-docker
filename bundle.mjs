#!/usr/bin/env zx
// TODO: enable type checking for this file.
import fs from 'node:fs/promises';
import 'zx/globals';

import { usePowerShell } from 'zx';

/* eslint-disable no-undef */

if (process.platform === 'win32') {
  usePowerShell();
  // for PowerShell compatibility
  $.prefix = '$ErrorActionPreference = "Stop";';
  $.postfix = '; exit $LastExitCode';
}

await fs.mkdir('./tmp').catch(() => {});

await fs.rename('./build/libdragon-linux', './tmp/libdragon');
await $`tar -C ./tmp -cvzf libdragon-linux-x86_64.tar.gz libdragon`;
await fs.rm('./tmp/libdragon');

await fs.rename('./build/libdragon-macos', './tmp/libdragon');
await $`tar -C ./tmp -cvzf libdragon-macos-x86_64.tar.gz libdragon`;
await fs.rm('./tmp/libdragon');

await fs.rename('./build/libdragon.exe', './tmp/libdragon.exe');
await $`Compress-Archive -Path ./tmp/libdragon.exe -DestinationPath libdragon-win-x86_64.zip`;
// Do not remove the win executable, it will be used for building the installer

await $`iscc setup.iss /dMyAppVersion=${process.argv[2]}`;

# Change Log

## [7.0.0] - 2021-06-06

### Changed

- Update GCC (10.2.0), binutils (2.36.1) and newlib (4.1.0) (https://github.com/DragonMinded/libdragon/pull/130)
- Remove internal forceLatest parameter
- Refactor internal constants
- Update dependencies

### Fixed

- Free stdio file handles when closed (https://github.com/DragonMinded/libdragon/pull/128)

### Added

- Default exception handler (https://github.com/DragonMinded/libdragon/pull/126)
- New debugging library (https://github.com/DragonMinded/libdragon/pull/130)
  - Not final, may have bugs or it may change in the future

## [6.0.2] - 2021-04-03

### Fixed

- Fix icache ops (https://github.com/DragonMinded/libdragon/pull/122)
- Rewrite timer.c to avoid messing up the COP0 hardware counter (https://github.com/DragonMinded/libdragon/pull/123)
- Fix 16k EEPROM detection (https://github.com/DragonMinded/libdragon/pull/124)

### Added

- Support GCC nested functions (https://github.com/DragonMinded/libdragon/pull/122)

## [6.0.1] - 2021-07-02

### Changed

- Makefile: add -ffunction-sections and -fdata-sections to libdragon (https://github.com/DragonMinded/libdragon/pull/121)
- Running vscode tasks now always rebuild libdragon examples and tests
- Root makefile always rebuilds examples and tests
- Update readme

### Fixed

- C++ test example works now (https://github.com/DragonMinded/libdragon/pull/118)
- Delay functions work correctly now (https://github.com/DragonMinded/libdragon/pull/120)
- Fix broken bench makefile
- Fix incorrect rom name for resolution test vscode launch configuration

### Added

- `installDragon` vscode task to make and install libdragon to the container

## [6.0.0] - 2021-23-01

### Changed

- Update base Dockerfile to use the latest toolchain setup and make it deduce processor count for the toolchain build
- `make` action does not first restart the container anymore. This will result in minor performance gains when running make
- `libdragon` command does not always exit with code 1 anymore, it instead echoes the underlying error code if known
- Updated toolchain dockerfile to strip symbols from executables and remove locales and built a new base image. Closes #8
- Move code into modules
- Do not put unnecessary files into the NPM package
- Renamed `dragonInstall` npm script to `prepareDragon`
- Readme improvements

### Fixed

- Start using child_process spawn to prevent buffer issues. Fixes #2
- Colors are now properly displayed when using the wrapper. Fixes #21

### Added

- Readme update instructions. Closes #20
- Readme root makefile instructions
- A red message to show the error if any, including subprocess exit codes
- An additional `installDependencies` libdragon action and NPM script. It does what we used to do after `download` and `start` when running `install`
- `-fdiagnostics-color` for the local test bench to enable color output

## [5.0.0] - 2021-16-01

### Changed

- dfs: fix performance of dfs_seek to be constant-time (https://github.com/DragonMinded/libdragon/pull/115)
  - This changes the file system layout

### Fixed

- n64sys: fix dma cache ops (https://github.com/DragonMinded/libdragon/pull/116)
- Added a new root makefile to batch multiple operations. Fixes #10
- Added local search paths to improve test bench compile time. Fixes #18

### Added

- Exposed the TV_TYPE at 0x80000300 as a n64sys function (https://github.com/DragonMinded/libdragon/pull/113)
- Initial libdragon testsuite (https://github.com/DragonMinded/libdragon/pull/117)
- Launch configurations for the new test suite and existing examples
- Launch configuration to clean everything

## [4.1.4] - 2020-31-12

### Changed

- Update readme for submodule update procedure (https://github.com/anacierdem/libdragon-docker/pull/17)

### Fixed

- Prevent newlines in the output (https://github.com/anacierdem/libdragon-docker/pull/19)

## [4.1.3] - 2020-16-12

### Changed

- Removed broken patreon shield. This is only a readme change.

## [4.1.2] - 2020-15-12

### Changed

- Updated readme on how to use this repository.
- Update dependencies.
- Update ed64 to `1.2.0`.

### Fixed

- n64tool: fix bug in detection of unaligned image sizes (https://github.com/DragonMinded/libdragon/pull/109)
- tools/build: Set default number of jobs to number of processors (https://github.com/DragonMinded/libdragon/pull/111)
- Build script fixes (https://github.com/DragonMinded/libdragon/pull/112)

## [4.1.1] - 2020-05-10

### Changed

- Updated readme on how to use this repository. Fixes #14.
- Update dependencies.

### Fixed

- Fix examples' n64tool argument order. (https://github.com/DragonMinded/libdragon/pull/103)
- Change ucodetest Makefile mode from 775 to 644. (https://github.com/DragonMinded/libdragon/pull/104)

## [4.1.0] - 2019-21-05

### Fixed

- RSP macros now supports negative offsets. (https://github.com/DragonMinded/libdragon/pull/99)
- Exception handler properly works and sets cause register to `cr` on `reg_block_t`. (https://github.com/DragonMinded/libdragon/pull/95)
- Padding on data sections were causing boot issues. They are properly padded. (https://github.com/DragonMinded/libdragon/pull/98)
- n64tool: Broken ROM issue is fixed when doing byte-swapping or zero-padding. (https://github.com/DragonMinded/libdragon/pull/97)
- GCC 10 support with default `-fno-common`. (https://github.com/DragonMinded/libdragon/pull/96)

### Added

- Exception cause map is now implemented and it is accessible via `info` on `exception_t`. (https://github.com/DragonMinded/libdragon/pull/95)

### Changed

- n64tool: Less IO operations for faster ROM build times. (https://github.com/DragonMinded/libdragon/pull/97)

## [4.0.1] - 2019-25-04

### Fixed

- Add missing vscode files.

## [4.0.0] - 2019-24-04

### Added

- Add ability to run a local test bench with ed64 support.
- Add `dragonInstall` and `build` NPM scripts for managing the test bench.
- Add vscode files for quick test bench execution.
- `devDependencies` are now also searched for makefiles and installed in the container.

### Changed

- Container mount path for this repository (NPM scripts) is now the repository root instead of `.\libdragon-source`.
  - make commands are now executed inside `.\libdragon-source`.
  - This will not effect consumers unless they depend on container's `/libdragon` path for explicitly accessing source files or relative paths with make's `-C`. They are now relative to repository root.
  - `--mount-path` is still supported although not used on this repository anymore. These changes do not effect a local/global installation.

## [3.2.0] - 2020-24-04

### Changed

- MIT license

## [3.1.0] - 2019-25-03

### Added

- Add function to detect expansion pak (https://github.com/DragonMinded/libdragon/pull/91)

### Changed

- No need a tag for a travis deploy anymore.

## [3.0.0] - 2019-11-02

### Changed

- Fixed vand opcode (https://github.com/DragonMinded/libdragon/pull/86)
- Reimplement mtc2/mfc2 with the extended syntax allowed by RSP (https://github.com/DragonMinded/libdragon/pull/89)
- Improve error message when using MIPS opcodes not available on RSP (https://github.com/DragonMinded/libdragon/pull/90)

### Added

- Transfer Pak support (https://github.com/DragonMinded/libdragon/pull/88)

## [2.0.5] - 2019-07-12

### Changed

- Added support information.

## [2.0.4] - 2019-07-12

### Changed

- Updated readme.
- Removed version injection as the versions have diverged with libdragon.

## [2.0.3] - 2019-06-12

### Changed

- Updated readme.
- Use base version for `start` and `download` actions if self-building in CI.
- Remove unnecessary toolchain start on `update` action.
- Start correct version on `buildDragon`.

## [2.0.2] - 2019-30-11

### Changed

- Running `install` command now starts the container.

## [2.0.1] - 2019-30-11

### Changed

- Updated repository URL.

## [2.0.0] - 2019-30-11

### Changed

- Separate the docker deployment process from library code.
- Upgraded `binutils` to 2.33.1.
- Improved ucode example and fixed byte alignment.
- Removed confusing assemply macros from `ucode.S`. This changed vector and scalar register names.
- Built a new base docker hub image tagged `toolchain`.
- Running `download` command no longer starts the container.

## [1.3.15] - 2019-01-11

### Changed

- `libdragon install` should skip CI checks.

## [1.3.14] - 2019-31-10

### Changed

- Skip make install if no Makefile is found.

## [1.3.12] - 2019-29-10

### Changed

- Reduce response time for NPM commands.
- Remove unnecessary console statements and double logs.

## [1.3.11] - 2019-29-10

### Fixed

- Fix problem with wait ticks. They do not lock the system now.

## [1.3.9] - 2019-27-10

### Added

- Add texture mirroring. https://github.com/DragonMinded/libdragon/commit/00a6cc8e6d136cf2578a50320f6ff0814dfb6657

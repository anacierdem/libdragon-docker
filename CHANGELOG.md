# Change Log

## [10.4.0] - 2022-03-19

### Fixed

- Attach the error handler once for spawnProcess.
- Update the root makefile to utilize `SOURCE_DIR` for example builds. Then we are
  able to map container files to local files properly with a generic regex in the
  problem matcher. This fixes #13 and does not change any behaviour.
- Add missing examples to the vscode run configurations.
- Update vulnerable dependencies.

### Added

- `--directory` option to customize vendoring location.
- `--strategy` option to select a vendoring strategy. Currently supported options
  are `submodule` and `manual`, which can be used to opt-out of auto vendoring
  via submodule. Useful if the user wants to utilize a different vendoring strategy.

### Changed

- Migrate to a json file for persistent project information.
- Only save the configuration file on successful exit except for the initial
  migration.
- Minor performance improvements.

## [10.3.1] - 2022-01-25

### Fixed

- Do not try to parse arguments after exec/make. They used to get evaluated as
  libdragon paramaters previously, preventing passing down -v to the container
  make for example.
- Docker image update issues
  - Attempt an image update whenever the image flag is provided. Previously this
    was only done if a different image name is provided, preventing the update of
    the latest image. Previously not providing an image name was behaving the same
    so this is not a breaking change.
  - Start action used to update the image if provided but this bug was already
    prevented by previous fixes by not accepting the image flag for actions other
    than init/update/install. Start action no longer tries to update the image
    regardless.

### Changed

- Only accept he image flag for init, install, and update actions as documented.
- Improve documentation for the `init` and `install` actions.
- Do not attempt an `install` when running `exec`, just start the container. If
  there is a half-baked container, a manual `install` will potentially restore it.
- Update libdragon.

### Added

- Extra information for skipping the image flag when doing init for an already
  initialized project.

## [10.3.0] - 2022-01-20

### Changed

- Update dependencies.
- Detailed help output.
- Move action descriptions to `libdragon help`.
- Update libdragon to latest version for local build.

### Added

- Shorthand flag support.

## [10.2.1] - 2021-10-14

### Changed

- Updated ed64.

### Fixed

- Fix skeleton project to match latest libdragon.

## [10.2.0] - 2021-10-10

### Added

- Container discovery. The tool can now find a container even if `.git` is lost.
- A few additional error messages for some potentially confusing cases such as
  already having a file with `libdragon` like name.

### Changed

- Show more output for downloading the container and initial git operations.
- Remove an extra log during initialization.
- The submodule was always being initialized when a container is started. This
  was making some actions inconsistent. For example `install` or `make` action
  was trying to re-initialize the submodule unnecessarily. This is fixed by only
  initializing it with the `init` action. If any of those need to re-init the
  container, now they assume there is an intact libdragon folder to use.
- Similarly a git repository is not initialized unnecessarily anymore.
- `update` and `install` are now able to start containers if necessary.
- Always try to copy skeleton files, they won't overwrite anything already.
- Do not re-initialize if there is a `.libdragon` folder. We now only try to
  start it in this case. If it is not a complete container, it can probably be
  recovered by a `libdragon install` or `libdragon update`.

### Fixed

- Fix wording for libdragon install on the container.
- Improve image name persitence such that the tool finds and updates it more
  consistently.

## [10.1.0] - 2021-10-07

### Added

- `exec` action to execute arbitrary commands in the container with TTY support.
  This also improves the color output support as docker now knows it is using TTY.
- Add more verbose logging for skeleton project copy.

### Changed

- Removed partially not working `--byte-swap` option. It does not already work
  with the new libdragon build system so there is no need keeping it in the tool.

### Fixed

- Publish skeleton project files to NPM.

## [10.0.0] - 2021-10-04

### Changed

- A complete re-write of the tool. Check documentation for the new usage. It is
  much more straightforward to use now. `libdragon make` behaves almost the same.

## [9.0.0] - 2021-09-06

### Changed

- Updated libdragon. We will be changing the update mechanism to be based on a
  git pull, so listing them here will not be useful anymore, let's not bother now.
- Start using the new build system.
- Update node engine spec to be at least 14.
- Added minimum docker version to readme.

### Added

- Github actions integration
  - Start building a standalone Windows executable

### Fixed

- Fixed changelog dates to ISO8601

## [8.0.0] - 2021-07-28

### Changed

- Removed make, download, init, buildDragon, prepareDragon, and installDependencies NPM scripts
  - Update the necessary vscode and travis configuration
  - Update the readme to match - this also fixes #31
- Improve fastpath of dfs_read (https://github.com/DragonMinded/libdragon/pull/133)
- Refactor n64tool (https://github.com/DragonMinded/libdragon/pull/153, https://github.com/DragonMinded/libdragon/pull/155)
  - It no longer support byte-swapping and only generates a z64 file.
  - Change test bench Makefile to reflect latest changes

### Fixed

- Zero-initialize the token array to avoid -Werror=maybe-uninitialized (https://github.com/DragonMinded/libdragon/pull/134)
- Initialize arguments to main libdragon entrypoint (https://github.com/DragonMinded/libdragon/pull/136)
- SD support fixes and dragonfs fopen fix (https://github.com/DragonMinded/libdragon/pull/137)
- lib/include paths in tests Makefile (https://github.com/DragonMinded/libdragon/pull/138)
- Reenable test_timer_ticks for emulators (https://github.com/DragonMinded/libdragon/pull/140)
- n64tool: return error in case the seek offset required backward seek (https://github.com/DragonMinded/libdragon/pull/144)
- Add missing extern "C" in debug.h (https://github.com/DragonMinded/libdragon/pull/146)
- Ensure C++ global constructors are not garbage collected by ld (https://github.com/DragonMinded/libdragon/pull/148)
- Fix clipped RDP rectangle drawing (https://github.com/DragonMinded/libdragon/pull/147)
- Enable byte swap flag for the make action and update documentation accordingly
- Skip the second parameter to the libdragon command as well
- Enable --byte-swap flag for the make action

### Added

- restart_timer and new_timer_stopped functions (https://github.com/DragonMinded/libdragon/pull/131)
- dfs_rom_addr (https://github.com/DragonMinded/libdragon/pull/133)
- Implement EEPROM Filesystem and test ROM (https://github.com/DragonMinded/libdragon/pull/125)
- ed64romconfig binary (https://github.com/DragonMinded/libdragon/pull/153, https://github.com/DragonMinded/libdragon/pull/155)
- Support for RTC status/read/write commands (https://github.com/DragonMinded/libdragon/pull/152)
- Generic libdragon NPM script

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

## [6.0.2] - 2021-03-04

### Fixed

- Fix icache ops (https://github.com/DragonMinded/libdragon/pull/122)
- Rewrite timer.c to avoid messing up the COP0 hardware counter (https://github.com/DragonMinded/libdragon/pull/123)
- Fix 16k EEPROM detection (https://github.com/DragonMinded/libdragon/pull/124)

### Added

- Support GCC nested functions (https://github.com/DragonMinded/libdragon/pull/122)

## [6.0.1] - 2021-02-07

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

## [6.0.0] - 2021-01-23

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

## [5.0.0] - 2021-01-16

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

## [4.1.4] - 2020-12-31

### Changed

- Update readme for submodule update procedure (https://github.com/anacierdem/libdragon-docker/pull/17)

### Fixed

- Prevent newlines in the output (https://github.com/anacierdem/libdragon-docker/pull/19)

## [4.1.3] - 2020-12-16

### Changed

- Removed broken patreon shield. This is only a readme change.

## [4.1.2] - 2020-12-15

### Changed

- Updated readme on how to use this repository.
- Update dependencies.
- Update ed64 to `1.2.0`.

### Fixed

- n64tool: fix bug in detection of unaligned image sizes (https://github.com/DragonMinded/libdragon/pull/109)
- tools/build: Set default number of jobs to number of processors (https://github.com/DragonMinded/libdragon/pull/111)
- Build script fixes (https://github.com/DragonMinded/libdragon/pull/112)

## [4.1.1] - 2020-10-05

### Changed

- Updated readme on how to use this repository. Fixes #14.
- Update dependencies.

### Fixed

- Fix examples' n64tool argument order. (https://github.com/DragonMinded/libdragon/pull/103)
- Change ucodetest Makefile mode from 775 to 644. (https://github.com/DragonMinded/libdragon/pull/104)

## [4.1.0] - 2019-05-21

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

## [4.0.1] - 2019-04-25

### Fixed

- Add missing vscode files.

## [4.0.0] - 2019-04-24

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

## [3.2.0] - 2020-04-24

### Changed

- MIT license

## [3.1.0] - 2019-03-25

### Added

- Add function to detect expansion pak (https://github.com/DragonMinded/libdragon/pull/91)

### Changed

- No need a tag for a travis deploy anymore.

## [3.0.0] - 2019-02-11

### Changed

- Fixed vand opcode (https://github.com/DragonMinded/libdragon/pull/86)
- Reimplement mtc2/mfc2 with the extended syntax allowed by RSP (https://github.com/DragonMinded/libdragon/pull/89)
- Improve error message when using MIPS opcodes not available on RSP (https://github.com/DragonMinded/libdragon/pull/90)

### Added

- Transfer Pak support (https://github.com/DragonMinded/libdragon/pull/88)

## [2.0.5] - 2019-12-07

### Changed

- Added support information.

## [2.0.4] - 2019-12-07

### Changed

- Updated readme.
- Removed version injection as the versions have diverged with libdragon.

## [2.0.3] - 2019-12-06

### Changed

- Updated readme.
- Use base version for `start` and `download` actions if self-building in CI.
- Remove unnecessary toolchain start on `update` action.
- Start correct version on `buildDragon`.

## [2.0.2] - 2019-11-30

### Changed

- Running `install` command now starts the container.

## [2.0.1] - 2019-11-30

### Changed

- Updated repository URL.

## [2.0.0] - 2019-11-30

### Changed

- Separate the docker deployment process from library code.
- Upgraded `binutils` to 2.33.1.
- Improved ucode example and fixed byte alignment.
- Removed confusing assemply macros from `ucode.S`. This changed vector and scalar register names.
- Built a new base docker hub image tagged `toolchain`.
- Running `download` command no longer starts the container.

## [1.3.15] - 2019-11-01

### Changed

- `libdragon install` should skip CI checks.

## [1.3.14] - 2019-10-31

### Changed

- Skip make install if no Makefile is found.

## [1.3.12] - 2019-10-29

### Changed

- Reduce response time for NPM commands.
- Remove unnecessary console statements and double logs.

## [1.3.11] - 2019-10-29

### Fixed

- Fix problem with wait ticks. They do not lock the system now.

## [1.3.9] - 2019-10-27

### Added

- Add texture mirroring. https://github.com/DragonMinded/libdragon/commit/00a6cc8e6d136cf2578a50320f6ff0814dfb6657

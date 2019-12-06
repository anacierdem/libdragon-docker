# Change Log

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

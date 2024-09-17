## [11.1.3](https://github.com/anacierdem/libdragon-docker/compare/v11.1.2...v11.1.3) (2024-09-17)


### Bug Fixes

* streamline dependencies ([49aa08e](https://github.com/anacierdem/libdragon-docker/commit/49aa08e827febb612189989ba99fa5683a6f927b))

## [11.1.2](https://github.com/anacierdem/libdragon-docker/compare/v11.1.1...v11.1.2) (2024-09-17)


### Bug Fixes

* include the installer in the release ([46299ba](https://github.com/anacierdem/libdragon-docker/commit/46299ba0c635227e363c23b3b58738ca8b01bad4))

## [11.1.1](https://github.com/anacierdem/libdragon-docker/compare/v11.1.0...v11.1.1) (2024-09-17)


### Bug Fixes

* include the cli with the correct version in the installer ([a8a9804](https://github.com/anacierdem/libdragon-docker/commit/a8a9804e3d882f3f8435205f236c7ff8b2c17950))

# [11.1.0](https://github.com/anacierdem/libdragon-docker/compare/v11.0.3...v11.1.0) (2024-09-16)


### Features

* add experimental Windows installer ([83aab64](https://github.com/anacierdem/libdragon-docker/commit/83aab64f040eafc48f27c282e95de7477362f53c))

## [11.0.3](https://github.com/anacierdem/libdragon-docker/compare/v11.0.2...v11.0.3) (2024-02-16)


### Bug Fixes

* **init.js:** do not run git init unnecessarily ([0a5688f](https://github.com/anacierdem/libdragon-docker/commit/0a5688f45ce0eb0ed91e5f5daedac24d24099afd)), closes [#69](https://github.com/anacierdem/libdragon-docker/issues/69)

## [11.0.2](https://github.com/anacierdem/libdragon-docker/compare/v11.0.1...v11.0.2) (2024-02-13)


### Bug Fixes

* find parent git root in case running in a submodule ([e34c30b](https://github.com/anacierdem/libdragon-docker/commit/e34c30baea57cbd51e5330443dc54d5443662384))

## [11.0.1](https://github.com/anacierdem/libdragon-docker/compare/v11.0.0...v11.0.1) (2024-02-09)


### Bug Fixes

* **init.js:** make sure providing --image flag uses the provided image ([965fe41](https://github.com/anacierdem/libdragon-docker/commit/965fe416322562a153bab9c5bf2f8c994fae562e)), closes [#66](https://github.com/anacierdem/libdragon-docker/issues/66)

# [11.0.0](https://github.com/anacierdem/libdragon-docker/compare/v10.9.1...v11.0.0) (2023-11-11)


### Code Refactoring

* **install.js:** remove docker image update support from install action ([8c768fd](https://github.com/anacierdem/libdragon-docker/commit/8c768fd1ec74e381a59acd28a6d1a69f75ed5de4))
* **project-info.js:** drop support for legacy configuation file ([880f38d](https://github.com/anacierdem/libdragon-docker/commit/880f38da71aa0876cb04785e7c05814c406a4dbd))


### BREAKING CHANGES

* **project-info.js:** The cli will no longer migrate the `.libdragon/docker-image` Either make sure you
run the 10.x version once for your project or remove the file manually.
* **install.js:** Providing --image/-i flag to the install action will now error out.

## [10.9.1](https://github.com/anacierdem/libdragon-docker/compare/v10.9.0...v10.9.1) (2023-06-01)


### Bug Fixes

* release with the updated dependencies ([af7a8fb](https://github.com/anacierdem/libdragon-docker/commit/af7a8fb4eed767de37dcd98efc89e4ec584f77c4))

# [10.9.0](https://github.com/anacierdem/libdragon-docker/compare/v10.8.2...v10.9.0) (2022-11-13)


### Features

* add support for running inside a container ([ac9c80b](https://github.com/anacierdem/libdragon-docker/commit/ac9c80b9fa9edc1db5b58f64912add85fbfb369c))

## [10.8.2](https://github.com/anacierdem/libdragon-docker/compare/v10.8.1...v10.8.2) (2022-09-25)


### Bug Fixes

* make ts more stricter and fix potential edge cases ([5890be0](https://github.com/anacierdem/libdragon-docker/commit/5890be0346a736611a60cf6ac01166a9a3179a34))

## [10.8.1](https://github.com/anacierdem/libdragon-docker/compare/v10.8.0...v10.8.1) (2022-09-23)


### Bug Fixes

* **init.js:** prevent premature failure when the vendor target already exists ([9c76ece](https://github.com/anacierdem/libdragon-docker/commit/9c76eceb77b0e63effc8f6a2c8ca782eabd3f260))
* **init.js:** show a custom error when the submodule operation fails ([bd40a9f](https://github.com/anacierdem/libdragon-docker/commit/bd40a9f38ef0e60e3c43e70b4d0e647a4db8a97a)), closes [#57](https://github.com/anacierdem/libdragon-docker/issues/57)


### Reverts

* revert changelog removal ([e34b21d](https://github.com/anacierdem/libdragon-docker/commit/e34b21db8b17f5cdcebfdd45404aa1270d773595))

# [10.8.0](https://github.com/anacierdem/libdragon-docker/compare/v10.7.1...v10.8.0) (2022-05-14)


### Features

* **init.js:** add vendored library detection ([4465d08](https://github.com/anacierdem/libdragon-docker/commit/4465d08993b987d694de9675ea4bd9784e073cd5))

## [10.7.1] - 2022-04-20

### Fixed

- Migrating from and old version was incorrectly erroring out to do an additional
`init`, which is not necessarily required.

### Changed

- Do not print usage information when a command fails.

## [10.7.0] - 2022-04-17

### Fixed

- Logs properly goes to stderr now. Previously they were written to stdout. This
means the id output of the `start` action is now written to stdout while we can
also display other information on the terminal. This allowed enabling the docker
logs for a more responsive experience. The output of `help` still goes to stdout.

### Added

- Stdin consumption support. Now it is possible to pipe anything to `exec` and
it will pass it through to the target. In case of no running container, it will
keep a copy of the stdin stream until the docker process is ready. This enables
piping in data from the host if ever needed for some reason. This enables usages
like `cat file.txt | libdragon exec cat - | less`.
- Automatically convert host paths into posix format so that the user can use
the host's path autocompletion. It will also convert absolute host paths into
relative container paths automatically. Previously all paths were assumed to be
container paths relative to the location corresponding to the host cwd.
Closes #24.

### Changed

- Refactored process spawns.
- Refactored main flow and separated parsing logic.
- Reorder actions & correction on flag usage for help output.
- Setting `--verbose` for `start` does not guarantee the only-id output anymore.
- Refactored parameter parsing.
- Update submdule for local development.

## [10.6.0] - 2022-04-09
### Fixed

- Fix a path bug that would cause incorrect behaviour when the command is run
deeper than a single level in the project folder.
- Fix a potential issue where `build.sh`might be incorrectly found inexistant
if the OS is picky about the paths to have native separators.
- Only save project information when necessary. Previously actions like `help`
were saving project info mistakenly.

### Added

- `disasm` action to simplify disassembling ELF files generated by the toolchain.
- `version` action to display current version.
- `destroy` action to remove the libdragon project.
- Additional documentation for flags.
- Print duration information when verbose.

### Changed

- Refactored out NPM related functions.
- Moved usage parameters to respective actions files as a refactor.
- It is possible to provide an absolute path to init `--directory` as long as it
is inside the project directory. Previously it was possible to provide somewhere
outside the project, but it would fail with an unexpected error.
- Simplify saving mechanism. Each action now internally resolves into the data
to save if any.

## [10.4.2] - 2022-04-03

### Fixed

- Make sure actions depending on an `init` fail in a non-project directory to
keep the project state consistent. This fixes #51.
- `update` action now tries to update the toolchain image as well. Previously
this was not the case contrary to what someone would expect. Considering it won't
change the behaviour for non-latest images and the toolchain did not have any
breaking changes for a long time, this is not considered a breaking change either.
- `start` action was printing stuff other than the container id. It doesn't
anymore.
- Stop unnecessarily printing container id and a few messages related to updates.
- Fix a potential race condition that might cause unexpected failures.
- Correct some errors' exit codes.
### Added

- A new exit code (`4`) to represent unexpected conditions.

### Changed

- Deprecated providing the image flag for `install` action by displaying a
warning and removing it from documentation, without changing behaviour even
though it is higly unlikely this feature was ever used. It mainly exists for
historical reasons and it wil be removed in next major release.
- Update documentation to warn against changing strategy is a one way operation.
- Update documentation to reflect `update` action changes.
- Minor refactors.
- Update submodule for local environment.

## [10.4.1] - 2022-03-23

### Fixed

- Update the root makefile to utilize `SOURCE_DIR` for example builds. Then we are
  able to map container files to local files properly with a generic regex in the
  problem matcher. This fixes #13 and does not change any behaviour.
- Add missing examples to the vscode run configurations.
- Install and build libdragon related things in the container when `exec` and
  `make` causes a new container run. This was previously prevented on `v10.3.1`
  because it was unnecessarily delaying all exec operations when the container
  is started. Refactoring things allowed me to realize this can be improved
  instead of forcing the user to do a manual `install`.
- Fix a potential issue that may cause the git commands to run in current folder
  instead of the project root.
- Attach the error handler once for spawnProcess.
- Update vulnerable dependencies.

### Added

- `--directory` option to customize vendoring location.
- `--strategy` option to select a vendoring strategy. Currently supported options
  are `submodule`, `subtree` and `manual`. The default is `submodule` and `manual`
  can be used to opt-out of auto vendoring. Useful if the user wants to utilize
  a different vendoring strategy and opt-out of the auto-managed git flows.

### Changed

- Migrate to a json file for persistent project information.
- Only save the configuration file on successful exit except for the initial
  migration.
- Do not prevent init if there is a file named libdragon in the target folder.
  This used to cause problems on windows but I cannot reproduce it anymore
  with `2.33.1.windows.1`. It may be something caused by my old configuration.
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

- Only accept the image flag for init, install, and update actions as documented.
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

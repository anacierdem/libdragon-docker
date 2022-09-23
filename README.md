# Docker Libdragon

[![Build](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml)

This is a wrapper for a docker container to make managing the libdragon toolchain easier. It has the additional advantage that libdragon toolchain and library can be installed on a per-project basis instead of managing system-wide installations.

## Prerequisites

You should have [docker](https://www.docker.com/products/docker-desktop) (`>= 18`) installed on your system.

`git` is not strictly required to use the tool. Still, it is highly recommended to have git on your host machine as it will be used instead of the one in the container.

## Installation

This is primarily a node.js script which is also packaged as an executable. You have two options:

### pre-built

Download the [pre-built executable](https://github.com/anacierdem/libdragon-docker/releases/latest) for your system and put it somewhere on your PATH. It is discouraged to put it in your project folder.

<details>
  <summary>Windows instructions</summary>

  - Download the Windows executable and copy it to `C:\bin`
  - Press `Windows + R` key combination and then enter `rundll32 sysdm.cpl,EditEnvironmentVariables`
  - In the `Environment Variables` window find the `Path` variable under `User variables for <your user name>`
  - Double click it and add a new entry as `C:\bin`
  - Restart your computer.
  - You should now be able to use the `libdragon` on a command line or PowerShell.
  - To update it with a new version, just replace the file in `C:\bin`

</details>

<details>
  <summary>MacOS instructions</summary>

  - Download the MacOS executable and copy it to `/usr/local/bin`
  - Right click it and choose `Open`.
  - It will show a warning, approve it by clicking `Open` again. You can close the newly opened terminal window.
  - You should now be able to use the `libdragon` command.
  - To update it with a new version, replace the file in `/usr/local/bin` and repeat the other steps.

</details>

<details>
  <summary>Linux instructions</summary>

  - You should already know this :)

</details>

### via NPM

Install [node.js](https://nodejs.org/en/download/) (`>= 14`) and install `libdragon` as a global NPM package;

    npm install -g libdragon

To update the tool to the latest, do `npm i -g libdragon@latest`.

## Quick Guide

Navigate to the folder you want to initialize your project and invoke libdragon;

    libdragon init

On first `init` an example project will be created, the container will be downloaded, started and latest libdragon will get installed on it with all the example ROMs built. You can find all the example ROMs in the `libdragon` folder.

The container's `make` can be invoked on your current working directory via;

    libdragon make

Any additonal parameters are passed down to the actual make command. You can work on the files simultaneously with the docker container and any built artifacts will be available in project directory as it is mounted on the container.

To update the library and rebuild/install all the artifacts;

    libdragon update

In general, you can invoke libdragon as follows;

    libdragon [flags] <action>

Run `libdragon help [action]` for more details on individual actions.

## Recipes

### Using a different branch of libdragon

Initialize your project as usual:

    libdragon init

Then switch the submodule to the desired branch:

    cd ./libdragon
    git checkout opengl
    cd ..
    libdragon install

If your changes are on a different remote, then you will need to manage your git remotes as usual.

### Testing changes on libdragon

As libdragon is an actively developed library, you may find yourself at a position where you want to change a few things on it and see how it works. In general, if you modify the files in `libdragon` folder of your project, you can install that version to the docker container by simply running:

    libdragon install

This will update all the artifacts in your container and your new code will start linking against the new version when you re-build it via `libdragon make`. The build system should pick up the change in the library and re-compile the dependent files.

Instead of depending on the above command, you can re-build the library by making it a make dependency in your project:

```makefile
libdragon-install: libdragon
	$(MAKE) -C ./libdragon install

libdragon:
	$(MAKE) -C ./libdragon
```

If your build now depends on `libdragon-install`, it will force an install (which should be pretty quick if you don't have changes) and force the build system to rebuild your project when necessary.

If you clone this repository, this setup is pretty much ready for you. Make sure you have a working libdragon setup and you get the submodules (e.g `git submodule update --init`). Then you can run `libdragon make bench` to execute the code in `./src` with your library changes. Also see [test bench](#local-test-bench).

When managing your changes to the library, you have a few options:

#### **Using `submodule` vendor strategy.**

To be able to share your project with the library change, you would need to push it somewhere public and make sure it is cloned properly by your contributors. This is not recommended for keeping track of your changes but is very useful if you plan to contribute it back to upstream. In the latter case, you can push your submodule branch to your fork and easily open a PR.

#### **Using `subtree` vendor strategy.**

To be able to share your project with the library change, you just commit your changes. This is very useful for keeping track of your changes specific to your project. On the other hand this is not recommended if you plan to contribute it back to upstream because you will need to make sure your libdragon commits are isolated and do the juggling when pushing it somewhere via `git subtree push`.

## Working on this repository

After cloning this repository on a system with node.js (`>= 14`) & docker (`>= 18`), in this repository's root do;

    npm install

This will install all necessary NPM dependencies. Now it is time to get the original libdragon repository. (you can also clone this repository with `--recurse-submodules`)

    git submodule update --init

Then run;

    npm run libdragon -- init

to download the pre-built toolchain image, start and initialize it. This will also install [test bench](#local-test-bench) dependencies into the container if any.

Now you will be able to work on the files simultaneously with the docker container and any built binaries will be available in your workspace as it is mounted on the container.

There is a root `Makefile` making deeper makefiles easier with these recipes;

    bench: build the test bench (see below)
    examples: re-build libdragon examples
    tests: re-build the test ROM
    libdragon: build libdragon itself
    libdragon-install: install libdragon
    clean-bench: clean the test bench (see below)
    clean: clean everything and start from scratch

For example, to re-build the original libdragon examples do;

    npm run libdragon -- make examples

Similarly to run the `clean` recipe, run;

    npm run libdragon -- make clean

Keep in mind that `--` is necessary for actual arguments when using npm scripts.

To update the submodule and re-build everything;

    npm run libdragon -- update

### Local test bench

This repository also uses [ed64](https://github.com/anacierdem/ed64), so you can just hit F5 on vscode (The `Run Test Bench` launch configuration) to run the test code in `src` folder to develop libdragon itself quicker if you have an everdrive.

There are also additional vscode launch configurations to build libdragon examples and tests based on the currently built and installed libdragon in the docker container. Most of these will always rebuild so that they will use the latest if you made and installed an alternative libdragon. The test bench itself and a few examples (that use the new build system) will already rebuild and reinstall libdragon automatically. These will always produce a rom image using the latest libdragon code in the active repository via its make dependencies. You can clean everything with the `clean` task (open the command palette and choose `Run Task -> clean`).

### Developing the tool itself

For a quick development loop it really helps linking the code in this repository as the global libdragon installation. To do this run;

    npm link

in the root of the repository. Once you do this, running `libdragon` will use the code here rather than the actual npm installation. Then you can test your changes in the libdragon project here or elsewhere on your computer.

When you are happy with your changes, you can verify you conform to the coding standards via:

    npm run format-check
    npm run lint-check

You can auto-fix applicable errors by running `format` and `lint` scripts instead. Additionally, typescript is used as the type system. To be able to get away with transpiling the code during development, jsDoc flavor of types are used instead of inline ones. To check if your types, run:

    npm run tsc

This repository uses [`semantic-release`](https://github.com/semantic-release/semantic-release) and manages releases from specially formatted commit messages. To simplify creating them you can use:

    npx cz

It will create a `semantic-release` compatible commit from your current staged changes.

## As an NPM dependency

You can install libdragon as an NPM dependency by `npm install libdragon --save` in order to use docker in your N64 projects. A `libdragon` command similar to global intallation is provided that can be used in your NPM scripts as follows;

```json
"scripts": {
    "prepare": "libdragon init"
    "build": "libdragon make",
    "clean": "libdragon make clean"
}
```

See [here](https://github.com/anacierdem/ed64-example) for a full example.

## Developing a dependency

You can make an NPM package that a `libdragon` project can depend on. Just include a `Makefile` on the repository root with a default recipe and an `install` recipe. On the depending project, after installing libdragon and the dependency with `npm install <dep name> --save`, one can install libdragon dependencies on the current docker container using `package.json` scripts.

For example this `package.json` in the dependent project;

```json
{
    "name": "libdragonDependentProject",
    "version": "1.0.0",
    "description": "...",
    "scripts": {
        "build": "libdragon make",
        "clean": "libdragon make clean",
        "prepare": "libdragon init"
    },
    "dependencies": {
        "libdragon": <version>,
        "ed64": <version>
    }
}
```

will init the container for this project and run `make && make install` for `ed64` upon running `npm install`. To develop a dependency [this](https://github.com/anacierdem/libdragon-dependency) is a good starting point.

This is an experimental dependency management.

## TODOS

- [ ] TS thinks nothing is undefined. This should be fixed.
- [ ] Verify the NPM dependency mechanism is still working and add a test.

## Funding

If this tool helped you, consider supporting its development by sponsoring it!

# Docker Libdragon

[![Build](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml?branch=master)

This is a wrapper for a docker container to make managing the libdragon toolchain easier.

## Quick Install

On a machine with [docker](https://www.docker.com/products/docker-desktop) (`>= 18`), grab a [pre-built executable](https://github.com/anacierdem/libdragon-docker/releases/latest) and put it somewhere on your PATH. Then navigate to the folder containing your project and initialize libdragon;

    libdragon init

On first init the container will be downloaded, started and latest libdragon will get installed on it with all the example ROMs built. Now you should see all the example ROMs built in the `libdragon-source` folder.

The container's `make` action can be invoked on your current working directory via;

    libdragon make

Any additonal parameters are passed down to the actual make command. Then you will be able to work on the files simultaneously with the docker container and any built binaries will be available in the current directory as it is also mounted on the container. Also if you change your working directory, the `make` will be executed there.

## How does this work?

This is primarily a node.js script packaged into an executable. If you have [node.js](https://nodejs.org/en/download/) (`>= 14`), you can also do a global install and use the tool as well. For this, install `libdragon` as a global NPM package;

    npm install -g libdragon

and use it as usual. To update the tool to the latest, you can similarky use `npm i -g libdragon@latest`.

Getting latest libdragon is achieved via creating a local git repository as a submodule at `./libradon-source`. The tool also keeps track of the active image in the `.libdragon` folder, which also marks the location as a libdragon project. You should commit the contents of this folder.

### Updating libdragon

To update the library and rebuild all the artifacts;

    libdragon update

This will update the submodule from the remote branch, which is `trunk` when a libdragon project is first initialized. You can also switch to another branch in the submodule and run the command again to switch to that version. Keep in mind that this will first try to sync it with the upstream branch with a merge strategy, defaulting to remote HEAD.

## Working on this repository

After cloning this repository on a machine with node.js (`>= 14`) & docker (`>= 18`), in this repository's root you can simply do;

    npm install

This will install all necessary NPM dependencies. Then run;

    npm run libdragon -- init

to download the pre-built toolchain image from docker hub, get the original libdragon repository as a submodule, start and initialize it. This will also install test bench dependencies into the container if any.

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

This repository also uses [ed64](https://github.com/anacierdem/ed64), so you can just hit F5 on vscode (The `Run Test Bench` launch configuration) to run the test code in `src` folder to develop libdragon itself quicker if you have an everdrive. There is a caveat though: If you want the problem matcher to work properly, you should name this repository folder `libdragon` exactly.

There are also additional vscode launch configurations to build libdragon examples and tests based on the currently built and installed libdragon in the docker container. Most of these will always rebuild so that they will use the latest if you made and install an alternative libdragon. The test bench itself and a few examples (that use the new build system) will already build and install libdragon automatically. These will always produce a rom image using the latest libdragon code in the active repository via its make dependencies and relative includes. You can clean everything with the `clean` task (open the command palette and choose `Run Task -> clean`).

## As an NPM dependency

You can install libdragon as an NPM dependency by `npm install libdragon --save` in order to use docker in your N64 projects. A `libdragon` command similar to global intallation is provided that can be used in your NPM scripts as follows;

    "scripts": {
        "prepare": "libdragon install"
        "build": "libdragon make",
        "clean": "libdragon make clean"
    }

See [here](https://github.com/anacierdem/ed64-example) for a full example.

## Developing a dependency

You can make an NPM package that a `libdragon` project can depend on. Just include a `Makefile` on the repository root with a default recipe and an `install` recipe. On the depending project, after installing libdragon and the dependency with `npm install [dep name] --save`, one can install libdragon dependencies on the current docker container using `package.json` scripts.

For example this `package.json` in the dependent project;

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
            "ed64": [version]
        }
    }

will init the container for this project and run `make && make install` for `ed64` upon running `npm install`. To develop a dependency [this](https://github.com/anacierdem/libdragon-dependency) is a good starting point.

This is an experimental dependency management.

## Funding

If this tool helped you, consider supporting its development by sponsoring it!

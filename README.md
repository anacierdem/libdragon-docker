# Docker Libdragon

[![Build](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml?branch=master)

This is a wrapper for a docker container to make managing the libdragon toolchain easier.

## Quick Install

On a machine with [docker](https://www.docker.com/products/docker-desktop) (`>= 18`), grab a [pre-built executable](https://github.com/anacierdem/libdragon-docker/releases/latest) and put it somewhere on your PATH. Then navigate to the folder containing your project and initialize libdragon;

    libdragon init

On first init the container will be downloaded, started and latest libdragon will get installed on it with all the example ROMs built. Now you should see all the example ROMs built in the `libdragon-source` folder.

The container's `make` can be invoked on your current working directory via;

    libdragon make

Any additonal parameters are passed down to the actual make command. Then you will be able to work on the files simultaneously with the docker container and any built binaries will be available in the current directory as it is also mounted on the container.

To update the library and rebuild/install all the artifacts;

    libdragon update

See [Overall usage](#overall-usage) for more details.

## Overall usage

This is primarily a node.js script which is also packaged as an executable. If you have [node.js](https://nodejs.org/en/download/) (`>= 14`), you can also do a global install and use the tool as well. For this, install `libdragon` as a global NPM package;

    npm install -g libdragon

and use it as usual. To update the tool to the latest, you can similarly do `npm i -g libdragon@latest`.

You can invoke libdragon as follows;

    libdragon [flags] <action>

### Available actions

__`init`__

Creates a libdragon project in the current directory. Every libdragon project will have its own container instance. If you are in a git repository or an NPM project, libdragon will be created at their root also marking there with a `.libdragon` folder. Do not remove this folder as it keeps libdragon project information. You should commit the contents of this folder if you are using git.

__`make`__

Run the libdragon build system in the current directory. It will properly mirror your current working directory to the container, so if you change your working directory, `make` will be executed there in the container as well.

__`install`__

Attempts to build and install everything libdragon related (i.e `libdragon-source`) into the container. This includes all the tools and third parties used by libdragon except for the toolchain. If you have made changes to libdragon, you can execute this action to build everything based on your changes. If you are not working on libdragon, you can just use the `update` action instead.

__`update`__

This action will update the submodule from the remote branch (`trunk`) with a merge strategy and then perform a `libdragon install`. (A local git repository is created as a submodule at `./libradon-source` when the project is first initialized) You can use the `install` action to only update all libdragon related artifacts in the container given you have an intact `libdragon-source` at the root without touching the existing submodule.

__`start`__

Start the container assigned to the current libdragon project.

__`stop`__

Stop the container assigned to the current libdragon project.

### Available flags

__`--image <docker-image>`__

Use this flag to provide a custom image `<docker-image>` to use instead of the default. It should include the toolchain. It will be effective for `init`, `install` and `update` actions and will cause a re-initialization of the container if an image different from what was written to project configuration is provided.

__`--byte-swap`__

Enable byte-swapped ROM output for the build system.

__`--verbose`__

Be verbose. This will print all commands dispatched to the container and their outputs as well.

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

There are also additional vscode launch configurations to build libdragon examples and tests based on the currently built and installed libdragon in the docker container. Most of these will always rebuild so that they will use the latest if you made and installed an alternative libdragon. The test bench itself and a few examples (that use the new build system) will already build and install libdragon automatically. These will always produce a rom image using the latest libdragon code in the active repository via its make dependencies and relative includes. You can clean everything with the `clean` task (open the command palette and choose `Run Task -> clean`).

## As an NPM dependency

You can install libdragon as an NPM dependency by `npm install libdragon --save` in order to use docker in your N64 projects. A `libdragon` command similar to global intallation is provided that can be used in your NPM scripts as follows;

    "scripts": {
        "prepare": "libdragon init"
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

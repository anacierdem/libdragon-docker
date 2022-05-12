# Docker Libdragon

[![Build](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml)

This is a wrapper for a docker container to make managing the libdragon toolchain easier.

## Quick Install

On a system with [docker](https://www.docker.com/products/docker-desktop) (`>= 18`), grab a [pre-built executable](https://github.com/anacierdem/libdragon-docker/releases/latest) and put it somewhere on your PATH. Then navigate to the folder you want to initialize your project and invoke libdragon;

    libdragon init

On first `init` an example project will be created, the container will be downloaded, started and latest libdragon will get installed on it with all the example ROMs built. You can find all the example ROMs in the `libdragon` folder.

The container's `make` can be invoked on your current working directory via;

    libdragon make

Any additonal parameters are passed down to the actual make command. You can work on the files simultaneously with the docker container and any built artifacts will be available in project directory as it is mounted on the container.

To update the library and rebuild/install all the artifacts;

    libdragon update

`git` is not strictly required to use this tool as docker's git will be used instead. Still, it is highly recommended to have git on your host machine.

## Overall usage

This is primarily a node.js script which is also packaged as an executable. If you have [node.js](https://nodejs.org/en/download/) (`>= 14`), you can do a global install and use it as usual. To install `libdragon` as a global NPM package;

    npm install -g libdragon

To update the tool to the latest, do `npm i -g libdragon@latest`.

You can invoke libdragon as follows;

    libdragon [flags] <action>

Run `libdragon help [action]` for more details on individual actions.

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

## As an NPM dependency

You can install libdragon as an NPM dependency by `npm install libdragon --save` in order to use docker in your N64 projects. A `libdragon` command similar to global intallation is provided that can be used in your NPM scripts as follows;

    "scripts": {
        "prepare": "libdragon init"
        "build": "libdragon make",
        "clean": "libdragon make clean"
    }

See [here](https://github.com/anacierdem/ed64-example) for a full example.

## Developing a dependency

You can make an NPM package that a `libdragon` project can depend on. Just include a `Makefile` on the repository root with a default recipe and an `install` recipe. On the depending project, after installing libdragon and the dependency with `npm install <dep name> --save`, one can install libdragon dependencies on the current docker container using `package.json` scripts.

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
            "libdragon": <version>,
            "ed64": <version>
        }
    }

will init the container for this project and run `make && make install` for `ed64` upon running `npm install`. To develop a dependency [this](https://github.com/anacierdem/libdragon-dependency) is a good starting point.

This is an experimental dependency management.

## TODOS

- [ ] Skip CI checks for irrelevant changes.

## Funding

If this tool helped you, consider supporting its development by sponsoring it!

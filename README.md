# Docker Libdragon

[![Build Status](https://travis-ci.org/anacierdem/libdragon-docker.svg?branch=master)](https://travis-ci.org/anacierdem/libdragon-docker)

This is a wrapper for libdragon using a docker container to make managing the toolchain easier. Node.js is used to interact with the docker container for multi-platform support. You can inspect `index.js` if you prefer not to use node, but it makes things easier in general when working with docker.

## Quick Install

On a machine with node.js (>= 7.6) & docker, you can do a global install of the wrapper to get up and running quickly. For this, first install `libdragon` as a global NPM package and download the container;

    npm install -g libdragon
    libdragon download

Then navigate to the folder containing your project and start the container which will mount your current working directory into the container;

    libdragon start

Now you will be able to work on the files simultaneously with the docker container and any built binaries will be available in the current directory as it is mounted on the container.
You will need to share your working drive from docker UI for it to be able to access your workspace for Windows hosts.

The container's `make` command can be invoked on your current working directory via `libdragon make`.

    libdragon make

Any additonal parameters are passed down to the actual make command. For example you can use `-C` flag to invoke make on a directory instead.

    libdragon make -- -C your/path

Keep in mind that `--` is necessary for actual arguments to make.

The same docker container (with the default name of libdragon) will be used for all global `libdragon start`s. Successive commands will remove the old container and you will lose any changes in the container outside your working directory. So **BE CAREFUL** containers are temporary assets in this context.
See [Invoking libdragon](#Invoking-libdragon) for more details on available actions.

### ROM byte order

To use the toolchain's host make command with byte swap enabled, include the `--byte-swap` flag;

    libdragon --byte-swap make

### Bash

If you need more control over the toolchain container bash into it with;

    docker exec -i -t libdragon /bin/bash

## Using this repository

After cloning this repository on a machine with node.js (>= 7.6) & docker, in this repository's root you can simply do;

    npm install

This will install all necessary dependencies (including the pre-built toolchain image from docker hub), and start the toolchain container. (This will also use the name `libdragon` and will remove the global instance if any)

Then sync the original libdragon repository (or clone this repo with `--recurse-submodules` in the first place).

    git submodule update --init

Now you will be able to work on the files simultaneously with the docker container and any built binaries will be available in `libdragon-source` as it is mounted on the container.

After the build environment is ready, to build the examples do;

    npm run make examples

Similarly to run the `clean` recipe, run;

    npm run make clean

The toolchain `make` command will be only run at the root-level of libdragon's source, but additonal parameters are passed down to the actual make command. For example use `-C` flag to invoke make on a directory instead;

    npm run make -- -C your/path

Also keep in mind that the same docker container (with the default name of `libdragon`) will be used for all the git cloned libdragon instances, deleting your changes in the containers outside of the working folder.

### NPM scripts

A list of all available NPM scripts provided with this repository. Also see [Invoking libdragon](#Invoking-libdragon) section for more details on using libdragon commands.

**download:** `npm run download` downloads the pre-built docker image for the current version from docker hub.

**start:** `npm start` will start the container with the name `libdragon`.

**stop:** Stop the container via `npm stop`.

**make:** Runs `make` inside the container with given parameters.

**init:** If you prefer to build the docker image on your computer, do `npm run init`. This will build and start the container and may take a while as it will initialize the docker container and build the toolchain from scratch.

**prepare:** Invokes `install` on libdragon (see [Invoking libdragon](#Invoking-libdragon)), which will do all the magic on an `npm i`.

**buildDragon: _(CI only)_** Builds a new image using `dragon.Dockerfile`. This is used to build an incremental image for a new release.

**prepublishOnly: _(CI only)_** Pushes the newly built image to docker hub. Requires docker login.

## As an NPM dependency

You can install libdragon as an NPM dependency by `npm install libdragon --save` in order to use docker in your other N64 projects. In this case, your project name will be used as the container name and this is shared among all NPM projects using that name. Your project's root is mounted on the docker image. A `libdragon` command similar to global intallation is provided that can be used in your NPM scripts as follows;

    "scripts": {
        "init": "libdragon download",
        "build": "libdragon make",
        "clean": "libdragon make clean"
    }

See [here](https://github.com/anacierdem/ed64-example) for a full example and see [Invoking libdragon](#Invoking-libdragon) section for more details on libdragon commands.

## Developing a dependency

You can make an NPM package that a `libdragon` project can depend on. Just include a `Makefile` on the repository root with recipes for `all` and `install`. On the depending project, after installing libdragon and the dependency with `npm install [dep name]`, one can install libdragon dependencies on the current docker container using `package.json` scripts. See [Invoking libdragon](#Invoking-libdragon) section for more details on libdragon commands.

For example this package.json;

    {
        "name": "libdragonDependentProject",
        "version": "1.0.0",
        "description": "",
        "scripts": {
            "build": "libdragon make",
            "clean": "libdragon make clean",
            "prepare": "libdragon install"
        },
        "dependencies": {
            "ed64": [version]
        }
    }

will download the docker image, run it with the name `libdragonDependentProject` and run `make && make install` for `ed64` upon running `npm install`. To develop a dependency [this](https://github.com/anacierdem/libdragon-dependency) is a good starting point.

This is an experimental dependency management.

## Invoking libdragon

Available options for the `libdragon` command (`index.js`) are explained below. It is in the form `libdragon <flags> action parameters`.

There is an optional flag `--mount-path=<relative path>` that can be used to provide a mount path other than the project root. This is for example used in NPM scripts.

**download:** Pulls the docker image with the version in `package.json`. Only pulls the base image on CI.

**start:** Starts/re-starts the container named as the NPM project name and the version in `package.json`. Provide `--byte-swap` flag to start a container that will output `.v64` images. Accepts `--mount-path`.

**stop:** Stops the container.

**make:** Starts the container if not running and runs `make` in mounted folder with additional parameters. Please note that any path provided should be unix-compatible, so you should not use auto completion on non-unix systems.

**init:** Builds the toolchain image from scratch and then builds libdragon on top of it.

**install:** Does `download` and `start` actions followed by a dependency analysis step which will try to run `make && make install` in all NPM dependencies, effectively installing them in the active container. Accepts `--mount-path`.

**update: _(CI only)_** Starts uploading the docker image. Requires docker login.

**buildDragon: _(CI only)_** Builds a new image based on toolchain using `dragon.Dockerfile` and starts it.

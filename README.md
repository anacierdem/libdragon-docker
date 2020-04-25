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

The container's `make` action can be invoked on your current working directory via;

    libdragon make

Any additonal parameters are passed down to the actual make command. For example you can use `-C` flag to invoke make on a directory instead.

    libdragon make -- -C your/path

Keep in mind that `--` is necessary for actual arguments to make.

The same docker container (with the default name of `libdragon`) will be used for all global `libdragon start`s. Successive `start`/`stop` actions will remove the old container and you will lose any changes in the container outside your working directory. So **BE CAREFUL** containers are temporary assets in this context.
See [Invoking libdragon](#Invoking-libdragon) for more details on available actions.

### ROM byte order

To use the toolchain's host `make` action with byte swap enabled, include the `--byte-swap` flag;

    libdragon --byte-swap make

### Bash

If you need more control over the toolchain container bash into it with;

    docker exec -i -t libdragon /bin/bash

## Working on this repository

After cloning this repository on a machine with node.js (>= 7.6) & docker, in this repository's root you can simply do;

    npm install

This will install all necessary NPM dependencies. Then run;

    npm run dragonInstall

to download the pre-built toolchain image from docker hub and start it. This will also install test bench dependencies into the container.

Now it is time to sync the original libdragon repository. (or clone this repo with `--recurse-submodules` in the first place)

    git submodule update --init

Now you will be able to work on the files simultaneously with the docker container and any built binaries will be available in `libdragon-source` as it is mounted on the container.

After the build environment is ready, to build the examples do;

    npm run make examples

Similarly to run the `clean` recipe, run;

    npm run make clean

The `make` script will be only run at the root-level of this repository, but additonal parameters are passed down to the actual make command. For example use `-C` flag to invoke make on a directory instead;

    npm run make -- -C your/path

Keep in mind that a single docker container with the name of `libdragon` will be run for all the git cloned libdragon instances and the global installation's instance if any. Starting a new container will remove the old one, deleting your changes in it outside of your working folder.

### Local test bench

This repository also uses [ed64](https://github.com/anacierdem/ed64), so you can just hit F5 on vscode to run the test code in `src` folder to develop libdragon itself quicker. There is a caveat though: If you want the problem matcher to work properly, you should name this repository folder `libdragon` exactly.

### NPM scripts

A list of all available NPM scripts provided with this repository. Also see [Invoking libdragon](#Invoking-libdragon) section for more details on using libdragon actions.

**download:** `npm run download` downloads the pre-built docker image for the current version from docker hub.

**start:** `npm start` will start the container with the name `libdragon`.

**stop:** Stop the container via `npm stop`.

**make:** Runs `make` inside the container on libdragon-source with given parameters.

**init:** If you prefer to build the docker image on your computer, do `npm run init`. This will build and start the container and may take a while as it will initialize the docker container and build the toolchain from scratch.

**dragonInstall:** Invokes the `install` libdragon action for this repository, preparing the container for the local test bench. Using the `prepare` script to do this on `npm i` is not feasable on the main repository as it make things complicated on CI, where there is no build docker version yet on first install.

**build:** Use this to run the local test bench. It will build and install libdragon into the default container followed by `make` inside the container for the `src` folder. The src folder will always build to keep it in sync with libdragon. This can be used to test libdragon changes.

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

For example this `package.json` in the dependent project;

    {
        "name": "libdragonDependentProject",
        "version": "1.0.0",
        "description": "...",
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

There is an optional flag `--mount-path=<relative path>` that can be used to provide a mount path other than the project root.

**download:** Pulls the docker image with the version in `package.json`. Only pulls the base image on self-build.

**start:** Starts/re-starts the container named as the NPM project name and the version in `package.json`. Provide `--byte-swap` flag to start a container that will output `.v64` images. Accepts `--mount-path`.

**stop:** Stops the container.

**make:** Starts the container if not running and runs `make` in mounted folder with additional parameters. Please note that any path provided should be unix-compatible, so you should not use auto completion on non-unix systems.

**init:** Builds the toolchain image from scratch and then builds libdragon on top of it.

**install:** Does `download` and `start` actions followed by a dependency analysis step which will try to run `make && make install` in all NPM dependencies, effectively installing them in the active container. Accepts `--mount-path`. Do not use when building self. Very useful when using libdragon as an NPM dependency to set up everything on an `npm i` by putting it in the `prepare` script. This is also used in this repository to prepare the build environment for the test bench.

**update: _(CI only)_** Starts uploading the docker image. Requires docker login.

**buildDragon: _(CI only)_** Builds a new image based on toolchain using `dragon.Dockerfile` and starts it.

## Support

If this tool helped you, consider supporting its development at;

<a href="https://patreon.com/anacierdem"><img src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.herokuapp.com%2Fanacierdem&style=for-the-badge" /> </a>

# Docker Libdragon

[![Build](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/anacierdem/libdragon-docker/actions/workflows/ci.yml?branch=master)

This is a wrapper for libdragon using a docker container to make managing the toolchain easier. Node.js is used to interact with the docker container for multi-platform support. You can inspect `index.js` if you prefer not to use node, but it makes things easier in general when working with docker.

## Quick Install

On a machine with node.js (>= 14) & docker (>= 18), you can do a global install of the wrapper to get up and running quickly. For this, first install `libdragon` as a global NPM package;

    npm install -g libdragon

Or you can grap the pre-built executable from the releases and put it somewhere on your PATH if you are on Windows. Then you won't need node.js on you machine.

Then download the container;

    libdragon download

Then navigate to the folder containing your project and start the container which will mount your current working directory into the container;

    libdragon start

Now you will be able to work on the files simultaneously with the docker container and any built binaries will be available in the current directory as it is mounted on the container.
You will need to share your working drive from docker UI for it to be able to access your workspace for Windows hosts.

The container's `make` action can be invoked on your current working directory via;

    libdragon make

Any additonal parameters are passed down to the actual make command. For example you can use `-C` flag to invoke make on a directory instead.

    libdragon make -C your/path

The same docker container (with the default name of `libdragon`) will be used for all global `libdragon start`s. Successive `start`/`stop` actions will remove the old container and you will lose any changes in the container outside your working directory. So **BE CAREFUL** containers are temporary assets in this context.
See [Invoking libdragon](#Invoking-libdragon) for more details on available actions.

### Updating the docker image

To update your docker image to the latest available, you can first install the latest npm package and then issue a new download action to fetch it. Finally you can start the new container, replacing the old one;

    npm install -g libdragon@latest
    libdragon download
    libdragon start

You can change `latest` to whichever version you want to switch to.

### Using a different libdragon chain

    With your preferred libdragon on your working environment run;

    libdragon make
    libdragon make install
    libdragon make tools-install

### ROM byte order

To use the toolchain's host `make` action with byte swap enabled, include the `--byte-swap` flag;

    libdragon --byte-swap make

Or you can start the container with byte swap enabled in the first place;

    libdragon --byte-swap start

### Bash

If you need more control over the toolchain container bash into it with;

    docker exec -it libdragon /bin/bash

## Working on this repository

After cloning this repository on a machine with node.js (>= 14) & docker, in this repository's root you can simply do;

    npm install

This will install all necessary NPM dependencies. Then run;

    npm run libdragon -- install

to download the pre-built toolchain image from docker hub and start it. This will also install test bench dependencies into the container.

Now it is time to get the original libdragon repository. (or clone this repo with `--recurse-submodules` in the first place)

    git submodule update --init

Now you will be able to work on the files simultaneously with the docker container and any built binaries will be available in your workspace as it is mounted on the container.

The `make` command will be only run at the root-level of this repository, but additonal parameters are passed down to the actual make. For example use `-C` flag to invoke make on a directory instead;

    npm run libdragon -- make -C your/path

As an example, to build the original libdragon examples do;

    npm run libdragon -- make -C ./libdragon-source examples

Similarly to run the `clean` recipe, run;

    npm run libdragon -- make -C ./libdragon-source clean

Keep in mind that `--` is necessary for actual arguments when using npm scripts.

There is also a root makefile making deeper makefiles easier with these recipes;

    bench: build the test bench (see below)
    examples: re-build libdragon examples
    tests: re-build the test ROM
    libdragon: build libdragon itself
    libdragon-install: install libdragon
    clean-bench: clean the test bench (see below)
    clean: clean everything and start from scratch

So some of the above operations can be simplified to;

    npm run libdragon -- make examples

Keep in mind that a single docker container with the name of `libdragon` will be run for all the git cloned libdragon instances and the global installation's instance if any. Starting a new container will remove the old one, deleting your changes in it outside of your working folder.

After some while, the libdragon submodule may become out of sync. To update the submodule;

    cd libdragon-source
    git checkout trunk
    git pull

### Local test bench

This repository also uses [ed64](https://github.com/anacierdem/ed64), so you can just hit F5 on vscode (The `Run Test Bench` launch configuration) to run the test code in `src` folder to develop libdragon itself quicker if you have an everdrive v3. There is a caveat though: If you want the problem matcher to work properly, you should name this repository folder `libdragon` exactly.

There are also additional vscode luanch configurations to build libdragon examples and tests based on the currently built and installed libdragon in the docker container. These will always rebuild so that they will use the latest if you make and install an alternative libdragon, which you can do with the `installDragon` vscode task. To run it open the command palette and choose `Run Task -> installDragon`. If you have made changes, do not forget to first run the `installDragon` task for your changes to be effective on the examples and tests. The test bench itself will already build libdragon only if necessary. In contrast to libdragon's internal examples/tests no extra step is needed, it will always produce a rom image using the latest libdragon code in the active repository via its make dependencies and relative includes. Similarly you can clean everything with the `clean` task.

### NPM scripts

A list of all available NPM scripts provided with this repository. Keep in mind that `--` is necessary for actual arguments to the scripts.

**libdragon:** `npm run libdragon` invokes libdragon command with the provided parameters. The parameters should be added after a `--` to be effective when using this script. e.g; `npm run libdragon -- make`. Also see [Invoking libdragon](#Invoking-libdragon) section for more details on using libdragon actions.

**start:** `npm start` will start the container with the name `libdragon`. Flags will not work when using this script.

**stop:** Stop the container via `npm stop`.

**build:** Use this to run the local test bench. It will build and install libdragon into the default container followed by `make` inside the container for the `src` folder. The src folder will always build to keep it in sync with libdragon. This can be used to test libdragon changes.

**prepublishOnly: _(CI only)_** Pushes the newly built image to docker hub. Requires docker login.

## As an NPM dependency

You can install libdragon as an NPM dependency by `npm install libdragon --save` in order to use docker in your other N64 projects. In this case, your project name will be used as the container name and this is shared among all NPM projects using that name. Your project's root is mounted on the docker image. A `libdragon` command similar to global intallation is provided that can be used in your NPM scripts as follows;

    "scripts": {
        "prepare": "libdragon install"
        "build": "libdragon make",
        "clean": "libdragon make clean"
    }

See [here](https://github.com/anacierdem/ed64-example) for a full example and see [Invoking libdragon](#Invoking-libdragon) section for more details on libdragon actions.

## Developing a dependency

You can make an NPM package that a `libdragon` project can depend on. Just include a `Makefile` on the repository root with a default recipe and an `install` recipe. On the depending project, after installing libdragon and the dependency with `npm install [dep name] --save`, one can install libdragon dependencies on the current docker container using `package.json` scripts. See [Invoking libdragon](#Invoking-libdragon) section for more details on libdragon actions.

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

**start:** Starts/re-starts the container with the installed libdragon version naming it to the active NPM project name. This will translate to `libdragon` for a global installation and the current NPM project name for a local installation. Provide `--byte-swap` flag to start a container that will output `.v64` images by default. Accepts `--mount-path`.

**stop:** Stops the container.

**make:** Runs `make` in mounted folder with additional parameters. Will not work without starting the container first. Please note that any path provided should be unix-compatible, so you should not use auto completion on non-unix systems. Accepts `--byte-swap`.

**init:** Builds the toolchain image from scratch and then builds libdragon on top of it.

**install:** Executes `download`, `start` and then `installDependencies` actions.

**installDependencies**: Runs a dependency analysis step which will try to run `make && make install` in all NPM dependencies, effectively installing them in the active container. Accepts `--mount-path`. Do not use when building self. Very useful when using libdragon as an NPM dependency to set up everything on an `npm i` by putting it in the `prepare` script. This is also used in this repository to prepare the build environment for the test bench.

**update: _(CI only)_** Starts uploading the docker image. Requires docker login.

**buildDragon: _(CI only)_** Builds a new image based on the existing toolchain image using `dragon.Dockerfile` and starts it.

## Funding

If this tool helped you, consider supporting its development by sponsoring it!

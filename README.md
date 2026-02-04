# Docker Libdragon

[![Build](https://github.com/anacierdem/libdragon-docker/actions/workflows/release.yml/badge.svg?branch=master)](https://github.com/anacierdem/libdragon-docker/actions/workflows/release.yml)

This is a wrapper for a docker container to make managing the libdragon toolchain easier. It has the additional advantage that libdragon toolchain and library can be installed on a per-project basis instead of managing system-wide installations.

> [!NOTE]
> I've started this project a few years before [devcontainers](https://containers.dev/) were a thing. The cli still works and provides minor additional functionality, but if you already have a containerized environment, I suggest using a devcontainer instead. It is doing essentially the same thing. You can find more info in [`libdragon` devcontainer](#libdragon-configuration) section. I'll continue to improve that configuration to make it a compelling alternative.

## Prerequisites

You should have [docker](https://www.docker.com/products/docker-desktop) (`>= 27.2.0`) and [git](https://git-scm.com/downloads) installed on your system.

## Installation

This is primarily a node.js script which is also packaged as an executable. You have a few options:

### installer

Download the [windows installer](https://github.com/anacierdem/libdragon-docker/releases/latest) and run it. This option is currently only available on Windows.

<details>
  <summary>Detailed instructions</summary>

  - Download the Windows installer and run it
  - It can show a "Windows protected your PC" warning. Click "More info" and "Run anyway".
  - You should now be able to use the `libdragon` on a command line or PowerShell.
  - To update it with a new version, download a newer installer and repeat the steps above.

</details>

### pre-built executable

Download the [pre-built executable](https://github.com/anacierdem/libdragon-docker/releases/latest) for your system and put it somewhere on your PATH. It is discouraged to put it in your project folder.

<details>
  <summary>Windows instructions</summary>

  - Download Windows executable and copy it to `C:\bin`
  - Press `Windows + R` key combination and then enter `rundll32 sysdm.cpl,EditEnvironmentVariables`
  - In the `Environment Variables` window find the `Path` variable under `User variables for <your user name>`
  - Double click it and add a new entry as `C:\bin`
  - Restart your computer.
  - You should now be able to use the `libdragon` on a command line or PowerShell.
  - To update it with a new version, just replace the file in `C:\bin`

</details>

<details>
  <summary>MacOS instructions</summary>

  - Download MacOS executable and copy it to `/usr/local/bin`
  - Right click it and choose `Open`.
  - It will show a warning, approve it by clicking `Open` again. You can close the newly opened terminal window.
  - You should now be able to use the `libdragon` command.
  - To update it with a new version, replace the file in `/usr/local/bin` and repeat the other steps.

</details>

<details>
  <summary>Linux instructions</summary>

  - Download Linux executable and copy it to `~/.local/bin`, or somewhere convenient on your `PATH`.
  - Run `chmod u+x ~/.local/bin/libdragon`
  - You should now be able to use the `libdragon` command on new shell sessions.
  - To update it with a new version, replace the file and repeat the other steps.

</details>

### via NPM

Install [node.js](https://nodejs.org/en/download/) (`>= 22`) and install `libdragon` as a global NPM package;

```bash
npm install -g libdragon
```

To update the tool to the latest, do `npm i -g libdragon@latest`.

## Quick Guide

Navigate to the folder you want to initialize your project and invoke libdragon;

```bash
libdragon init
```

On first `init` an example project will be created, the container will be downloaded, started and latest libdragon will get installed on it with all the example ROMs built. You can find all the example ROMs in the `libdragon/examples` folder.

The container's `make` can be invoked on your current working directory via;

```bash
libdragon make
```

Any additonal parameters are passed down to the actual make command. You can work on the files simultaneously with the docker container and any built artifacts will be available in project directory as it is mounted on the container.

To update the library and rebuild/install all the artifacts;

```bash
libdragon update
```

In general, you can invoke libdragon as follows;

    libdragon [flags] <action>

Run `libdragon help [action]` for more details on individual actions.

## Recipes

### Using a different libdragon branch

Use the `--branch` flag to set up a custom libdragon branch when initializing your project:

```bash
libdragon init --branch unstable
```

This will use the `unstable` toolchain and code.

### Switching to a different branch of libdragon

On an already initialized project, switch the submodule to the desired branch:

```bash
git -C ./libdragon checkout opengl
libdragon install
```

If your changes are on a different remote, then you will need to manage your git remotes as usual. If you also want to update the remote tracking branch for the submodule, run:

```bash
git submodule set-branch -b opengl libdragon
```

This will update the branch on `.gitmodules` and if you commit that change, subsequent initializations will use the `opengl` branch by default.

### Testing changes on libdragon

As libdragon is an actively developed library, you may find yourself at a position where you want to change a few things on it and see how it works. In general, if you modify the files in `libdragon` folder of your project, you can install that version to the docker container by simply running:

```bash
libdragon install
```

This will update all the artifacts in your container and your new code will start linking against the new version when you re-build it via `libdragon make`. The build system should pick up the change in the library and re-compile the dependent files.

Instead of depending on the above command, you can automatically re-build the library by making it a make dependency in your project:

```makefile
libdragon-install:
	$(MAKE) -C ./libdragon install
```

If your build now depends on `libdragon-install`, it will force an install (which should be pretty quick if you don't have changes) and force the build system to rebuild your project when necessary.

If you clone this repository, this setup is pretty much ready for you. Make sure you have a working libdragon setup and you get the submodules (e.g `git submodule update --init`). Then you can run `libdragon make bench` to execute the code in `./src` with your library changes. Also see [test bench](#local-test-bench).

When managing your changes to the library, you have a few options:

#### **Using `submodule` vendor strategy.**

To be able to share your project with the library change, you would need to push it somewhere public and make sure it is cloned properly by your contributors. This is not recommended for keeping track of your changes but is very useful if you plan to contribute it back to upstream. In the latter case, you can push your submodule branch to your fork and easily open a PR.

#### **Using `subtree` vendor strategy.**

To be able to share your project with the library change, you just commit your changes. This is very useful for keeping track of your changes specific to your project. On the other hand this is not recommended if you plan to contribute it back to upstream because you will need to make sure your libdragon commits are isolated and do the juggling when pushing it somewhere via `git subtree push`.

## Working on this repository

> [!TIP]
> You can simply use [`development` devcontainer](#development-configuration) support to get up an running quickly if your development environment supports it.

After cloning this repository on a system with node.js (`>= 18`) & docker (`>= 27.2.0`), in this repository's root do;

```bash
npm install
```

This will install all necessary NPM dependencies. Now it is time to get the original libdragon repository. (you can also clone this repository with `--recurse-submodules`)

```bash
git submodule update --init
```

Then run;

```bash
npm run libdragon -- init
```

to download the pre-built toolchain image, start and initialize it. This will also install [test bench](#local-test-bench) dependencies into the container if any.

Now you will be able to work on the files simultaneously with the docker container and any built binaries will be available in your workspace as it is mounted on the container.

There is a root `Makefile` making deeper makefiles easier with these recipes;

    bench: build the test bench (see below)
    examples: build libdragon examples
    tests: build the test ROM
    libdragon-install: build and install libdragon
    clean-bench: clean the test bench (see below)
    clean: clean everything and start from scratch

For example, to re-build the original libdragon examples do;

```bash
npm run libdragon -- make examples
```

Similarly to run the `clean` recipe, run;

```bash
npm run libdragon -- make clean
```

> [!IMPORTANT]
> Keep in mind that `--` is necessary for actual arguments when using npm scripts.


To update the submodule and re-build everything;

```bash
npm run libdragon -- update
```

### Local test bench

The root `bench` recipe is for building the code in root `src` folder. This is a quick way of testing your libdragon changes or a sample code built around libdragon, and is called the test bench. This recipe together with `examples` and `tests` recipes will build and install libdragon automatically as necessary. Thus, they will always produce a rom image using the libdragon code in the repository via their make dependencies, which is ideal for experimenting with libdragon itself. 

There are also vscode launch configurations to quickly build and run the examples, tests and the bench. If you have [ares](https://ares-emu.net/) on your `PATH`, the launch configurations ending in `(emu)` will start it automatically. For the examples configuration, you can navigate to the relevant `.c` file and `Run selected example` will start it most of the time. In some cases, the output ROM name may not match the `.c` file and in those cases, you can select the ROM file instead and it should work.

> [!NOTE]
> This repository also uses [UNFLoader](https://github.com/buu342/N64-UNFLoader), so you can use the launch configurations without `(emu)` to run the code if you have a supported flashcart plugged in and have `UNFLoader` executable on your `PATH`.
>
> The special `Debug Test Bench (emu)` configuration will start ares with remote debugging for the test bench if you have `gdb-multiarch` executable on your `PATH`. It should automatically break in your `main` function.

You can clean everything with the `clean` recipe/task (open the command palette and choose `Run Task -> clean`).

### Developing the tool itself

For a quick development loop it really helps linking the code in this repository as the global libdragon installation. To do this run;

```bash
npm link
```

in the root of the repository. Once you do this, running `libdragon` will use the code here rather than the actual npm installation. Then you can test your changes in the libdragon project here or elsewhere on your computer.

When you are happy with your changes, you can verify you conform to the coding standards via:

```bash
npm run format-check
npm run lint-check
```

You can auto-fix applicable errors by running `format` and `lint` scripts instead. Additionally, typescript is used as the type system. To be able to get away with transpiling the code during development, jsDoc flavor of types are used instead of inline ones. To check your types, run:

```bash
npm run tsc
```

To run the test suite:

```bash
npm run test
```

This repository uses [`semantic-release`](https://github.com/semantic-release/semantic-release) and manages releases from specially formatted commit messages. To simplify creating them you can use:

```bash
npm run cz
```

It will create a `semantic-release` compatible commit from your current staged changes.

### Devcontainer support

The repository provides two devcontainer configurations (`development` and `libdragon`) for supported IDEs. If you have docker and a compatible IDE, you can quickly start working on this project.
To create your own dev container backed project, you can use the contents of the `.devcontainer` folder as reference.

<details>
  <summary>vscode instructions</summary>

  - Make sure you have the [Dev container extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) installed and you fulfill its [requirements](https://code.visualstudio.com/docs/devcontainers/containers).
  - Open command palette and run `Dev Containers: Reopen in container`.
  - Pick `development` or `libdragon` configuration.
  - It will prepare the container and open it in the editor.
</details>

#### `development` configuration

This has everything required to develop the tool itself. Just follow "Working on this repository" section inside the devcontainer.

#### `libdragon` configuration

This is an example devcontainer setup for using the libdragon toolchain to build n64 ROMs. To start building with libdragon:

- Clone this repository with `--recurse-submodules` or run `git submodule update --init` in the devcontainer.
- Run `cd libdragon && ./build.sh && cd ..` to build and install the library.
- Run `make bench` to build the [test bench](#local-test-bench). You'll see the rom in `src` folder.

If you setup a similar devcontainer for your project, you can immediately start building n64 ROMs using libdragon.

#### Future direction

- The cli is not enabled on `libdragon` devcontainer, so you cannot currently use actions like `install` or `disasm`. This is supported by the cli (via `DOCKER_CONTAINER`) but not yet enabled on the devcontainer.
- In the devcontainer, uploading via USB is not yet implemented.
- Error matching is not yet tested.
- Ideally the necessary extensions should be automatically installed. This is not configured yet.

## As an NPM dependency

You can install libdragon as an NPM dependency by `npm install libdragon --save` in order to use docker in your N64 projects. A `libdragon` command similar to global installation is provided that can be used in your NPM scripts as follows;
```json
"scripts": {
    "prepare": "libdragon init"
    "build": "libdragon make",
    "clean": "libdragon make clean"
}
```

## Funding

If this tool helped you, consider supporting its development by sponsoring it!


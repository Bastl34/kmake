# kmake

kmake is a build tool for c++ projects

## Features
* generate project files for different IDE's
* `kmake.yml` file based configuration
* command line config support
* file watcher with livereload
  * add/edit/delete files and kmake will add the files to the project and compiles again
* export to directory/zip/tar/tar.gz/...
* assets support
* download assets and libs
* hooks support
* icon generation

## Requrements
* node.js >=12
* Windows:
  * Visual Studio 2019
* Mac:
  * xCode or Clang
* Linux:
  * gcc

## Installation
* `npm i -g kmake`

## Run
* `kmake your_kmake.yml your_project_template output_dir`

## Dev
* `npm run dev-mac` (xCode)
* `npm run dev-vs` (Visual Studio 2019)
* `npm run dev-mk` (Makefile)

## Plaftorm settings
* see `examples/full/kmake.yml` as a full example

## Tips and tricks

* define strings via command line
  * `kmake examples/full vs2019 examples/full/out --define TEST_DEFINE=\"test\"`

* makefile: building for archs which are not on your system.
  * use: install: `gcc-multilib` and `g++-multilib`
  * on debian/ubuntu use: `sudo apt-get install gcc-multilib g++-multilib`
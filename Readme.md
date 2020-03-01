# kmake

## Requrements
* node.js >=12

## Usage
* `npm i -g kmake`
* `kmake your_kmake.yml your_project_template output_dir`

## Dev
* `npm run dev-mac`

## Plaftorm settings
you can define platform settings for:
* `defines`
* `includePaths`
* `dependencies`
* `hooks`
* `buildFlags`
* `linkerFlags`

## Tips and tricks

* define strings via command line
  * `kmake examples/cpp vs2019 examples/cpp/out --define TEST_DEFINE=\"test\"`
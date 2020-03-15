const path = require('path');
const spawn = require('child_process').spawn;

const chokidar = require('chokidar');

const Logging = require('./helper/logging');

function watch(options)
{
    let watchFiles = [];

    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        project.sources.forEach(file =>
        {
            watchFiles.push(file);
        })
    }

    const watcher = chokidar.watch(watchFiles, { ignoreInitial: true });

    let func = (change) =>
    {
        Logging.success('change detected')
        const watchCmd = spawn(options.build.watchCmd, {cwd: options.build.outputPath});

        watchCmd.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        watchCmd.stderr.on('data', (data) => {
            console.log(data.toString());
        });

        watchCmd.on('close', (code) => {});
    };

    watcher
        .on('add', path => func(path))
        .on('change', path => func(path))
        .on('unlink', path => func(path));

    func();
}

module.exports = watch;
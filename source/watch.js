const path = require('path');
const micromatch = require('micromatch');

const chokidar = require('chokidar');

const Logging = require('./helper/logging');

const projectFileSteps = ['options', 'make', 'build', 'run', 'export', 'test'];
const sourceFileSteps = ['build', 'run', 'export', 'test'];
const assetFileSteps = ['build', 'run', 'export', 'test'];

const TIMEOUT = 200;

class Watcher
{
    constructor()
    {
        this.files = [];
        this.watcher = null;

        this.timeout = null;
        this.lastChange = 0;
    }

    async watch(options, callback)
    {
        await this.clear();

        //kmake files
        options.projectFiles.forEach(file =>
        {
            this.files.push({path: path.resolve(file), exclude: null, steps: projectFileSteps});
        });

        for(let i in options.workspace.content)
        {
            let projectName = options.workspace.content[i];
            let project = options[projectName];

            //sources
            project.sources.forEach(file =>
            {
                this.files.push({path: path.resolve(file), exclude: null, steps: sourceFileSteps});
            });

            //assets
            if (project.assets)
            {
                project.assets.forEach(asset =>
                {
                    let sourcePath = path.resolve(path.join(project.workingDir, asset.source));
                    this.files.push({path: sourcePath, exclude: asset.exclude, steps: assetFileSteps});
                });
            }
        }

        let filePaths = this.files.map(file => file.path);
        this.watcher = chokidar.watch(filePaths, { ignoreInitial: true });

        let func = (changeType, changedPath) =>
        {
            let found = null;

            for(let i in this.files)
            {
                let file = this.files[i];

                let exclude = false;
                if (file.exclude)
                    exclude = micromatch.isMatch(path.basename(changedPath), file.exclude) || micromatch.isMatch(changedPath, file.exclude);

                if (changedPath.indexOf(file.path) != -1 && !exclude)
                {
                    found = file;
                    break;
                }
            }

            if (found)
            {
                //ignore if this was fired to fast
                if (this.timeout)
                    return;

                this.lastChange = Date.now();
                this.timeout = setTimeout(() =>
                {
                    callback(changeType, changedPath, found.steps);

                    this.timeout = null;
                },TIMEOUT);
            }
        }

        this.watcher
            .on('add', changedPath => func('add', changedPath))
            .on('change', changedPath => func('change', changedPath))
            .on('unlink', changedPath => func('unlink', changedPath))
            .on('addDir', changedPath => func('addDir', changedPath))
            .on('unlinkDir', changedPath => func('unlinkDir', changedPath));
    }

    async clear()
    {
        if (this.watcher)
            await this.watcher.close();
        this.watcher = null;

        this.files = [];

        if (this.timeout)
            clearTimeout(this.timeout);
        this.timeout = null;

        this.lastChange = 0;
    }
}

module.exports = Watcher;
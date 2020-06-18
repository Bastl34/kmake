const path = require('path');
const micromatch = require('micromatch');
const chokidar = require('chokidar');

const FileHelper = require('./helper/fileHelper');

const projectFileSteps = ['options', 'commands', 'make', 'build', 'run', 'export', 'test'];
const sourceFileSteps = ['build', 'run', 'export', 'test'];
const assetFileSteps = ['run', 'export', 'test'];
const commandsFileSteps = ['commands', 'run', 'export', 'test'];
const addedOrDeletedAdditionalSteps = ['options', 'make', 'commands'];

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

        // kmake files
        options.projectFiles.forEach(file =>
        {
            this.files.push({path: FileHelper.resolve(file), exclude: null, steps: projectFileSteps});
        });

        for(let i in options.workspace.content)
        {
            let projectName = options.workspace.content[i];
            let project = options[projectName];

            // sources
            if (project.sourcesBase)
            {
                project.sourcesBase.forEach(file =>
                {
                    file = FileHelper.resolve(path.join(project.workingDir, file));
                    file = FileHelper.unixPath(file);

                    this.files.push({path: file, exclude: null, steps: sourceFileSteps});
                });
            }

            // assets
            if (project.assets)
            {
                project.assets.forEach(asset =>
                {
                    let assetPath = FileHelper.resolve(path.join(project.workingDir, asset.source));
                    this.files.push({path: assetPath, exclude: asset.exclude, steps: assetFileSteps});
                });
            }

            // commands
            if (project.commandsBase)
            {
                project.commandsBase.forEach(command =>
                {
                    let commandPath = FileHelper.resolve(path.join(project.workingDir, command.source));
                    this.files.push({path: commandPath, steps: commandsFileSteps});
                });
            }
        }

        let filePaths = this.files.map(file => file.path);
        this.watcher = chokidar.watch(filePaths, { ignoreInitial: true });

        let func = (changeType, changedPath) =>
        {
            const absolutePath = FileHelper.resolve(changedPath);

            let found = null;

            for(let i in this.files)
            {
                let file = this.files[i];

                let exclude = false;
                if (file.exclude)
                    exclude = micromatch.isMatch(path.basename(changedPath), file.exclude) || micromatch.isMatch(changedPath, file.exclude);

                if (micromatch.isMatch(absolutePath, file.path) && !exclude)
                {
                    found = file;
                    break;
                }
            }

            if (found)
            {
                // ignore if this was fired to fast
                if (this.timeout)
                    return;

                this.lastChange = Date.now();
                this.timeout = setTimeout(() =>
                {
                    let steps = found.steps;
                    if (changeType != 'change')
                        steps = [...steps, ...addedOrDeletedAdditionalSteps];

                    const relativePath = path.relative(options.build.projectDir, changedPath);

                    callback(changeType, relativePath, steps);

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
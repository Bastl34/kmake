const fs = require('fs');
const copy = require('recursive-copy');

const Globals = require('./globals');

async function make(options)
{
    //some error checks
    let workspace = options.workspace || null;
    if (!workspace || !('content' in workspace) || !(workspace.content instanceof Array) || workspace.content.length == 0)
    {
        console.error('workspace not found or empty');
        return ;
    }

    //create output directory
    if (!fs.existsSync(options.build.outputPath))
        fs.mkdirSync(options.build.outputPath);

    //create project files
    if (options.build.template == 'xcodeMac')
        return await makeXcode(options);
}

async function makeXcode(options)
{
    //copy contents
    //options.workspace.content.forEach(projectName =>
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        if (!(projectName in options))
        {
            console.error('project ' + projectName + ' not found');
            return Promise.reject();
        }

        let project = options[projectName]

        let sourcePath = options.build.templatePath + '/' + project.outputType + '.xcodeproj';
        let destPath = options.build.outputPath + '/' + project.name + '.xcodeproj';

        let results = await copy(sourcePath, destPath, {overwrite: true});
        console.log(results.length + ' files copied');
    };
}

module.exports = make;
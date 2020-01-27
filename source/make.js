const fs = require('fs');
const copy = require('recursive-copy');
const replace = require('replace-in-file');

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

    //run validate
    await validate(options);

    //create output directory
    if (!fs.existsSync(options.build.outputPath))
        fs.mkdirSync(options.build.outputPath);

    //create project files
    if (options.build.template == 'xcodeMac')
        return await makeXcode(options);
}

async function validate(options)
{
    // check projects
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        if (!(projectName in options))
        {
            console.error('project ' + projectName + ' not found');
            return Promise.reject();
        }
    };
}

async function makeXcode(options)
{
    // ******************** copy projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        let sourcePath = options.build.templatePath + '/' + project.outputType + '.xcodeproj';
        let destPath = options.build.outputPath + '/' + project.name + '.xcodeproj';

        let results = await copy(sourcePath, destPath, {overwrite: true});
        console.log(results.length + ' files copied');
    };

    // ******************** generate .xcworkspace ********************
    let sourcePath = options.build.templatePath + '/workspace.xcworkspace';
    let destPath = options.build.outputPath + '/' + options.workspace.name + '.xcworkspace';

    let results = await copy(sourcePath, destPath, {overwrite: true});
    console.log(results.length + ' files copied');

    let fileRefStr = '';
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        fileRefStr += '   <FileRef location = "group:' + project.name + '.xcodeproj"></FileRef>\n'
    }

    let workspaceContentFilePath = destPath + '/contents.xcworkspacedata';

    results = await replace({files: workspaceContentFilePath, from: '<!--FileRef-->', to: fileRefStr.trim()});
    console.log(results.length + ' files changed');

    /*
<FileRef location = "group:app.xcodeproj"></FileRef>
    */
}

module.exports = make;
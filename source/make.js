const fs = require('fs');
const path = require('path');

const makeXcode = require('./projectMaker/xcode');

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

    //clear output dir if needed
    if (options.build.cleanOutputDir && fs.existsSync(path.normalize(options.build.outputPath)))
        fs.rmdirSync(path.normalize(options.build.outputPath), {recursive: true});

    //create output directory
    if (!fs.existsSync(path.normalize(options.build.outputPath)))
        fs.mkdirSync(path.normalize(options.build.outputPath));

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

module.exports = make;
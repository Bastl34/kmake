const fs = require('fs');
const path = require('path');
const Logging = require('./helper/logging');
const Helper = require('./helper/helper');

const makeXcode = require('./projectMaker/xcode');
const makeVisualStudio = require('./projectMaker/visualStudio');
const makeMakefile = require('./projectMaker/makefile');

async function make(options)
{
    // some error checks
    let workspace = options.workspace || null;
    if (!workspace || !('content' in workspace) || !(workspace.content instanceof Array) || workspace.content.length == 0)
    {
        Logging.error('workspace not found or empty');
        return false;
    }

    // run validate
    if (!validate(options))
    {
        Logging.error('validation failed');
        return false;
    }

    await createOutputDir(options);

    let res = false;

    // create project files
    if (options.build.template == 'xcodeMac')
        res = await makeXcode(options);
    else if (options.build.template == 'vs')
        res = await makeVisualStudio(options);
    else if (options.build.template == 'makefile')
        res = await makeMakefile(options);

    return res;
}

async function createOutputDir(options)
{
    // clear output dir if needed
    if (options.build.cleanOutputDir && fs.existsSync(path.normalize(options.build.outputPath)))
    {
        Logging.info('clearing output dir...');
        await fs.promises.rmdir(path.normalize(options.build.outputPath), {recursive: true});

        // wait some tome -> otherwise mkdir will fail on windows
        await Helper.sleep(100);
    }

    // create output directory
    if (!fs.existsSync(path.normalize(options.build.outputPath)))
    {
        Logging.info('creating output dir...');
        await fs.promises.mkdir(path.normalize(options.build.outputPath));
    }
}

function validate(options)
{
    // check projects
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        if (!(projectName in options))
        {
            Logging.error('project ' + projectName + ' not found');
            return false;
        }
    }

    return true;
}

module.exports = make;
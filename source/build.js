const os = require('os');
const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);

const Globals = require('./globals');

async function build(options)
{
    let res = null;
    if (os.platform() == 'darwin')
        res = await buildXcodeMac(options);
    //else if (os.platform() == 'win32')
    //    res = await buildVisualStudio(options);
    else if (os.platform() == 'linux')
        res = await buildMakefile(options);

    return res;
}

function findBuildProject(options)
{
    //if build project is set
    if (options.buildProject)
    {
        if (!(options.buildProject in options))
        {
            throw Error('project ' + options.buildProject + ' not found');
        }
        return options.buildProject;
    }

    //find main project
    if (!('workspace' in options))
        throw Error('workspace not found');

    if (!('content' in options.workspace))
        throw Error('workspace has no content');

    //sort projects by type
    let projects = [...options.workspace.content];

    //sort projects by output type -> to find the best matching project -> see globals -> PROJECT_TYPES for sorting order
    projects.sort((a, b) =>
    {
        let aType = options[a]['outputType'];
        let bType = options[b]['outputType'];

        let aValue = Globals.PROJECT_TYPES[aType];
        let bValue = Globals.PROJECT_TYPES[bType];

        return aValue - bValue;
    });

    if (projects.length > 0)
        return projects[0];

    throw Error('no build project found');
}

/*
async function buildVisualStudio(options)
{
}
*/

async function buildMakefile(options)
{
    const workspaceName = options.workspace.name;
    const mainProjectName = findBuildProject(options);

    //const outDir = path.join(options.build.outputPath, options.build.binOutputDir);

    const configName = options.build.release ? 'release' : 'debug';
    const archName = options.build.arch[0];

    const targetKey = mainProjectName + "_" + archName + '_' + configName;

    //build
    let res = await exec(`make ${targetKey}`, {cwd: options.build.outputPath});
    console.log(res.stdout);
    console.log(res.stderr);

    return true;
}

async function buildXcodeMac(options)
{
    const workspaceName = options.workspace.name;
    const mainProjectName = findBuildProject(options);
    const workspacePath = path.join(options.build.outputPath, workspaceName);

    const outDir = path.join(options.build.outputPath, options.build.binOutputDir);

    const configName = options.build.release ? 'Release' : 'Debug';

    //build
    let res = await exec(`xcodebuild build -configuration ${configName} -workspace ${workspacePath}.xcworkspace -scheme ${mainProjectName} -derivedDataPath ${outDir}`);
    console.log(res.stdout);
    console.log(res.stderr);

    return true;
}

module.exports = build;
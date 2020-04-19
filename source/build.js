const os = require('os');
const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);

const MakeHelper = require('./helper/makeHelper');

const Logging = require('./helper/logging');


async function build(options)
{
    if (options.build.template == 'xcodeMac')
        res = await buildXcodeMac(options);
    else if (options.build.template == 'vs2019')
        res = await buildVisualStudio(options);
    else if (options.build.template == 'makefile')
        res = await buildMakefile(options);

    return res;
}

async function buildVisualStudio(options)
{
    const workspaceName = options.workspace.name;
    const mainProjectName = MakeHelper.findBuildProject(options);

    const solutionPath = path.resolve(path.join(options.build.outputPath, workspaceName) + '.sln');
    const configName = options.build.release ? 'Release' : 'Debug';
    const arch = options.build.arch[0];

    const jobs = os.cpus().length;
    const msBuild = MakeHelper.findMsBuild();
    const buildCmd = `"${msBuild}" "${solutionPath}" /t:${mainProjectName} /p:Configuration=${configName} /p:Platform=${arch} /m:${jobs} /p:BuildInParallel=true`;

    //build
    let res = await exec(buildCmd);
    Logging.log(res.stdout);
    Logging.log(res.stderr);
}

async function buildMakefile(options)
{
    const mainProjectName = MakeHelper.findBuildProject(options);

    //const outDir = path.join(options.build.outputPath, options.build.binOutputDir);

    const configName = options.build.release ? 'release' : 'debug';
    const archName = options.build.arch[0];

    const targetKey = mainProjectName + "_" + archName + '_' + configName;

    //build
    let res = await exec(`make ${targetKey}`, {cwd: options.build.outputPath});
    Logging.log(res.stdout);
    Logging.log(res.stderr);

    return true;
}

async function buildXcodeMac(options)
{
    const workspaceName = options.workspace.name;
    const mainProjectName = MakeHelper.findBuildProject(options);
    const workspacePath = path.join(options.build.outputPath, workspaceName);

    const outDir = path.join(options.build.outputPath, options.build.binOutputDir);

    const configName = options.build.release ? 'Release' : 'Debug';

    //build
    let res = await exec(`xcodebuild build -configuration ${configName} -workspace ${workspacePath}.xcworkspace -scheme ${mainProjectName} -derivedDataPath ${outDir}`);
    Logging.log(res.stdout);
    Logging.log(res.stderr);

    return true;
}

module.exports = build;
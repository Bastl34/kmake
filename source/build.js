const os = require('os');
const path = require('path');
const Exec = require('./helper/exec');

const MakeHelper = require('./helper/makeHelper');

const Logging = require('./helper/logging');


async function build(options)
{
    await validate(options);

    if (options.build.template == 'xcodeMac')
        res = await buildXcodeMac(options);
    else if (options.build.template == 'vs2019')
        res = await buildVisualStudio(options);
    else if (options.build.template == 'makefile')
        res = await buildMakefile(options);

    return res;
}

function validate(options)
{
    let sourcesFound = 0;
    for(let itemKey in options)
    {
        let item = options[itemKey];

        if (item.sources && item.sources.length > 0)
            sourcesFound += item.sources.length;
    }

    if (sourcesFound == 0)
        return Promise.reject('no sources found');
    else
        return Promise.resolve();
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

    //build
    const cmd = `"${msBuild}" "${solutionPath}" /t:${mainProjectName} /p:Configuration=${configName} /p:Platform=${arch} /m:${jobs} /p:BuildInParallel=true`;
    return buildExecutable(cmd);
}

async function buildMakefile(options)
{
    const mainProjectName = MakeHelper.findBuildProject(options);

    //const outDir = path.join(options.build.outputPath, options.build.binOutputDir);

    const configName = options.build.release ? 'release' : 'debug';
    const archName = options.build.arch[0];

    const targetKey = mainProjectName + "_" + archName + '_' + configName;

    //build
    const cmd = `make ${targetKey}`
    return buildExecutable(cmd, options.build.outputPath);
}

async function buildXcodeMac(options)
{
    const workspaceName = options.workspace.name;
    const mainProjectName = MakeHelper.findBuildProject(options);
    const workspacePath = path.join(options.build.outputPath, workspaceName);

    const outDir = path.join(options.build.outputPath, options.build.binOutputDir);

    const configName = options.build.release ? 'Release' : 'Debug';

    //build
    const cmd = `xcodebuild build -configuration ${configName} -workspace ${workspacePath}.xcworkspace -scheme ${mainProjectName} -derivedDataPath ${outDir}`;
    return buildExecutable(cmd);
}

async function buildExecutable(cmd, cwd = null)
{
    const p = new Exec(cmd, cwd);
    p.on('stdout', out => Logging.log(out.trimRight()));
    p.on('stderr', out => Logging.log(out.trimRight()));
    p.on('error', out => Logging.error(out));
    p.on('exit', code => Logging.log('exit with code: ' + code));

    const res = await p.waitForExit();

    if (!res && !Logging.isVerbose())
        Logging.error(p.out);

    return res;
}

module.exports = build;
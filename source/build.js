const os = require('os');
const path = require('path');
const Exec = require('./helper/exec');

const Globals = require('./globals');
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
    let platform0 = options.build.arch[0];
    let config0 = Globals.CONFIGURATIONS[0];

    let sourcesFound = 0;

    for(let itemKey in options)
    {
        let item = options[itemKey];

        let sources = [];
        if ('sources' in item && platform0 in item.sources)
            sources = item.sources[platform0][config0];

        if (sources && sources.length > 0)
            sourcesFound += sources.length;
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

    for(let i in options.build.arch)
    {
        const arch = options.build.arch[i];

        const jobs = options.build.jobs;
        const msBuild = MakeHelper.findMsBuild();

        // build
        // /m:2
        const cmd = `"${msBuild}" "${solutionPath}" /t:${mainProjectName} /p:Configuration=${configName} /p:Platform=${arch} /p:CL_MPCount=${jobs} /p:BuildInParallel=true ${options.build.VS_BUILD_FLAGS}`;
        const success = await buildExecutable(cmd);

        // break if it's only needed to build one arch
        if (!options.build.buildAllArchs || !success)
            return success;
    }

    return true;
}

async function buildMakefile(options)
{
    const mainProjectName = MakeHelper.findBuildProject(options);

    const make = MakeHelper.getMake(options, options[mainProjectName]);

    for(let i in options.build.arch)
    {
        const configName = options.build.release ? 'release' : 'debug';
        const archName = options.build.arch[i];

        const jobs = options.build.jobs;
        const targetKey = mainProjectName + "_" + archName + '_' + configName;

        // build
        const cmd = `${make} ${targetKey} -j${jobs} ${options.build.MK_MAKE_FLAGS}`
        const success = await buildExecutable(cmd, options.build.outputPath);

        // break if it's only needed to build one arch
        if (!options.build.buildAllArchs || !success)
            return success;

        // clean obj files
        if (options.build.arch.length > 1)
            await buildExecutable(`${make} clean_obj`, options.build.outputPath);
    }

    return true;
}

async function buildXcodeMac(options)
{
    const workspaceName = options.workspace.name;
    const mainProjectName = MakeHelper.findBuildProject(options);
    const workspacePath = path.join(options.build.outputPath, workspaceName);

    const outDir = path.join(options.build.outputPath, options.build.binOutputDir);

    const configName = options.build.release ? 'Release' : 'Debug';

    // build
    const cmd = `xcodebuild build -configuration ${configName} -workspace ${workspacePath}.xcworkspace -scheme ${mainProjectName} -derivedDataPath ${outDir} ${options.build.XCODE_BUILD_FLAGS}`;
    return await buildExecutable(cmd);
}

async function buildExecutable(cmd, cwd = null)
{
    const p = new Exec(cmd.trim(), cwd);
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
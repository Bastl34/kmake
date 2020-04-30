const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);

const MakeHelper = require('./helper/makeHelper');

const Globals = require('./globals');
const Logging = require('./helper/logging');
const Exec = require('./helper/exec');

async function run(options, runAsync)
{
    if (options.build.template == 'xcodeMac')
        res = await runXcodeMac(options, runAsync);
    else if (options.build.template == 'vs2019')
        res = await runVisualStudio(options, runAsync);
    else if (options.build.template == 'makefile')
        res = await runMakefile(options, runAsync);

    return res;
}

async function runVisualStudio(options, runAsync)
{
    const mainProjectName = MakeHelper.findBuildProject(options);
    const outDir = path.resolve(options.build.outputPath);

    const configName = options.build.release ? 'Release' : 'Debug';
    const arch = options.build.arch[0];
    const binPath = path.join(outDir, arch, configName, mainProjectName + '.exe');

    return await runExecutable(binPath, runAsync, path.dirname(binPath));
}

async function runMakefile(options, runAsync)
{
    const mainProjectName = MakeHelper.findBuildProject(options);

    const configName = options.build.release ? 'release' : 'debug';
    const arch = options.build.arch[0];
    const binPath = path.join(options.build.outputPath, Globals.DEFAULT_BIN_DIR, arch, configName, mainProjectName);

    return await runExecutable(binPath, runAsync);
}

async function runXcodeMac(options, runAsync)
{
    const mainProjectName = MakeHelper.findBuildProject(options);

    const configName = options.build.release ? 'Release' : 'Debug';

    const outDir = path.join(options.build.outputPath, options.build.binOutputDir);
    const appDir = path.join(outDir, 'Build/Products', configName, mainProjectName + '.app');
    const binPath = path.join(appDir, 'Contents/MacOS', mainProjectName);
    const mainPath = path.join(outDir, 'Build/Products', configName, mainProjectName);

    //app
    if (options[mainProjectName].outputType == 'app')
        return await runExecutable(binPath, runAsync);
    //main
    else
        return await runExecutable(mainPath, runAsync);
}

async function runExecutable(cmd, runAsync, cwd = null)
{
    const process = new Exec(`"${cmd}"`, cwd);
    process.on('stdout', out => Logging.log(out));
    process.on('stderr', out => Logging.log(out));
    process.on('exit', code => Logging.log('exit with code: ' + code));

    if (!runAsync)
        return await process.waitForExit();

    return process;
}


module.exports = run;
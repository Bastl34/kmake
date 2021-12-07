const path = require('path');

const MakeHelper = require('./helper/makeHelper');

const Globals = require('./globals');
const Logging = require('./helper/logging');
const Exec = require('./helper/exec');

async function run(options, runAsync)
{
    let res = false;
    if (options.build.template == 'xcodeMac')
        res = await runXcodeMac(options, runAsync);
    else if (options.build.template == 'vs')
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

    return await runExecutable(binPath, runAsync, path.dirname(binPath));
}

async function runXcodeMac(options, runAsync)
{
    const mainProjectName = MakeHelper.findBuildProject(options);

    const configName = options.build.release ? 'Release' : 'Debug';

    const outDir = path.join(options.build.outputPath, options.build.binOutputDir);
    const appDir = path.join(outDir, 'Build/Products', configName, mainProjectName + '.app');
    const binPath = path.join(appDir, 'Contents/MacOS', mainProjectName);
    const mainPath = path.join(outDir, 'Build/Products', configName, mainProjectName);

    // app
    if (options[mainProjectName].outputType == 'app')
        return await runExecutable(binPath, runAsync);

    // main
    return await runExecutable(mainPath, runAsync);
}

async function runExecutable(cmd, runAsync, cwd = null)
{
    const p = new Exec(`"${cmd}"`, cwd);
    p.on('stdout', out => process.stdout.write(out));
    p.on('stderr', out => process.stderr.write(out));
    p.on('error', out => process.stderr.write(out));
    p.on('exit', code => Logging.log('exit with code: ' + code));

    if (!runAsync)
        return await p.waitForExit();

    return p;
}


module.exports = run;
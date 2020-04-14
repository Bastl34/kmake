const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);

const MakeHelper = require('./helper/makeHelper');

const Globals = require('./globals');
const Logging = require('./helper/logging');

async function run(options)
{
    if (options.build.template == 'xcodeMac')
        res = await runXcodeMac(options);
    else if (options.build.template == 'vs2019')
        res = await runVisualStudio(options);
    else if (options.build.template == 'makefile')
        res = await runMakefile(options);

    return res;
}

async function runVisualStudio(options)
{
    const mainProjectName = MakeHelper.findBuildProject(options);
    const outDir = path.join(options.build.outputPath, options.build.binOutputDir);

    const configName = options.build.release ? 'Release' : 'Debug';
    const arch = options.build.arch[0];
    const binPath = path.join(outDir, arch, configName, mainProjectName + '.exe');

    res = await exec(`"${binPath}"`);
    Logging.log(res.stdout);
    Logging.log(res.stderr);

    return true;
}

async function runMakefile(options)
{
    const mainProjectName = MakeHelper.findBuildProject(options);

    const configName = options.build.release ? 'release' : 'debug';
    const arch = options.build.arch[0];
    const binPath = path.join(options.build.outputPath, Globals.DEFAULT_BIN_DIR, arch, configName, mainProjectName);

    //run
    let res = await exec(`"${binPath}"`);
    Logging.log(res.stdout);
    Logging.log(res.stderr);

    return true;
}

async function runXcodeMac(options)
{
    const mainProjectName = MakeHelper.findBuildProject(options);

    const configName = options.build.release ? 'Release' : 'Debug';

    const outDir = path.join(options.build.outputPath, options.build.binOutputDir);
    const appDir = path.join(outDir, 'Build/Products', configName, mainProjectName + '.app');
    const binPath = path.join(appDir, 'Contents/MacOS', mainProjectName);
    const mainPath = path.join(outDir, 'Build/Products', configName, mainProjectName);

    if (options[mainProjectName].outputType == 'app')
    {
        let res = await exec(`${binPath}`);
        Logging.log(res.stdout);
        Logging.log(res.stderr);
    }
    //main
    else
    {
        let res = await exec(`${mainPath}`);
        Logging.log(res.stdout);
        Logging.log(res.stderr);
    }

    return true;
}


module.exports = run;
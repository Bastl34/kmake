const os = require('os');
const util = require('util');
const path = require('path');
const colors = require('colors');

const Helper = require('./helper/helper');
const Logging = require('./helper/logging');
const MakeHelper = require('./helper/makeHelper');

const exec = util.promisify(require('child_process').exec);

const MAIN = 'source/index.js';
const BUILD_CONFIG = 'Release';

const OUT_DIR = 'out';
const BIN_DIR = 'bin';

(async () =>
{
    try
    {
        await runTests()
    }
    catch (e)
    {
        console.error(e);
    }
})();

async function runTests()
{
    if (os.platform() == 'darwin')
        await xcodeMac();
    else if (os.platform() == 'win32')
        await visualStudio();

    console.log(colors.rainbow('✔✔✔ all tests successful ✔✔✔'));
}

async function xcodeMac()
{
    const project = 'examples/cpp';
    const template = 'xcodeMac';
    const workspaceName = 'Example';
    const mainProjectName = 'bla';

    Logging.info(' ========== ' + testXcodeWorkspace.name + ' ==========')
    await testXcodeWorkspace(project, template, workspaceName, mainProjectName);
}

async function visualStudio()
{
    const project = 'examples/cpp';
    const template = 'vs2019';
    const workspaceName = 'Example';
    const mainProjectName = 'bla';

    Logging.info(' ========== ' + testVisualStudioSolution.name + ' ==========')
    await testVisualStudioSolution(project, template, workspaceName, mainProjectName);
}

async function testXcodeWorkspace(project, template, workspaceName, mainProjectName)
{
    const outDir = path.join(project, OUT_DIR);
    const binDir = path.join(outDir, BIN_DIR);
    const workspacePath = path.join(outDir, workspaceName);
    const binPath = path.join(binDir, 'Build/Products', BUILD_CONFIG, mainProjectName + '.app', 'Contents/MacOS', mainProjectName);

    //create project (workspace)
    await exec(`node ${MAIN} ${project} ${template} ${outDir} --useInputCache 1`);

    //build
    await exec(`xcodebuild build -configuration ${BUILD_CONFIG} -workspace ${workspacePath}.xcworkspace -scheme ${mainProjectName} -derivedDataPath ${binDir}`);

    //test bin
    await exec(`./${binPath}`);
}

async function testVisualStudioSolution(project, template, workspaceName, mainProjectName)
{
    const outDir = path.join(project, OUT_DIR);
    const solutionPath = path.resolve(path.join(outDir, workspaceName) + '.sln');
    const configName = 'Release';
    const platform = 'x64';
    const binPath = path.join(outDir, platform, configName, mainProjectName + '.exe');
    const jobs = os.cpus().length;
    const msBuild = MakeHelper.findMsBuild();
    const buildCmd = `"${msBuild}" "${solutionPath}" /p:Configuration=${configName} /p:Platform=${platform} /m:${jobs} /p:BuildInParallel=true`;

    //build project (solution)
    await exec(`node ${MAIN} ${project} ${template} ${outDir} --useInputCache 1`);
    await Helper.sleep(10000);

    //build
    let res = await exec(buildCmd);
    console.log(res.stdout);
    console.log(res.stderr);

    //test bin
    res = await exec(`"${binPath}"`);
    console.log(res.stdout);
    console.log(res.stderr);
}
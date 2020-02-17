const os = require('os');
const util = require('util');
const path = require('path');

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
        console.err(e);
    }
})();


async function runTests()
{
    if (os.platform() == 'darwin')
        xcodeMac();
}


async function xcodeMac()
{
    const project = 'examples/cpp';
    const template = 'xcodeMac';
    const workspaceName = 'Example';
    const mainProjectname = 'bla';

    const outDir = path.join(project, OUT_DIR);
    const binDir = path.join(outDir, BIN_DIR);
    const workspacePath = path.join(outDir, workspaceName);
    const binPath = path.join(binDir, 'Build/Products', BUILD_CONFIG, mainProjectname + '.app', 'Contents/MacOS', mainProjectname);

    await exec(`node ${MAIN} ${project} ${template} ${outDir} --useInputCache 1`);
    await exec(`xcodebuild build -configuration ${BUILD_CONFIG} -workspace ${workspacePath}.xcworkspace -scheme bla -derivedDataPath ${binDir}`);
    await exec(`./${binPath}`);
}
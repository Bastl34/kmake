const path = require('path');

const Logging = require('./helper/logging');
const Exec = require('./helper/exec');

async function open(options, runAsync)
{
    let res = false;
    if (options.build.template == 'xcodeMac')
        res = await openXcodeMac(options, runAsync);
    else if (options.build.template == 'vs')
        res = await openVisualStudio(options, runAsync);
    return res;
}

async function openVisualStudio(options, runAsync)
{
    const versionSelector = path.join(process.env['ProgramFiles(X86)'], 'Common Files', 'Microsoft Shared', 'MSEnv', 'VSLauncher.exe');

    const workspaceName = options.workspace.name;
    const solutionPath = path.resolve(path.join(options.build.outputPath, workspaceName) + '.sln');

    let cmd = `"${versionSelector}" "${solutionPath}"`;

    return await runExecutable(cmd);
}

async function openXcodeMac(options, runAsync)
{
    const workspaceName = options.workspace.name;
    const workspacePath = path.resolve(path.join(options.build.outputPath, workspaceName) + '.xcworkspace');

    let cmd = `open ${workspacePath}`;

    return await runExecutable(cmd);
}

async function runExecutable(cmd, cwd = null)
{
    const p = new Exec(cmd, cwd);
    p.on('stdout', out => process.stdout.write(out));
    p.on('stderr', out => process.stderr.write(out));
    p.on('error', out => process.stderr.write(out));
    p.on('exit', code => Logging.log('exit with code: ' + code));

    return await p.waitForExit();
}

module.exports = open;
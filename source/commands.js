const path = require('path');
const glob = require('glob');

const Globals = require('./globals');
const Logging = require('./helper/logging');
const Exec = require('./helper/exec');

async function commands(options)
{
    let platform0 = options.build.arch[0];
    let config0 = Globals.CONFIGURATIONS[0];

    // ******************** resolve source files ********************
    Logging.info('resolving source files...');
    for(let itemKey in options)
    {
        let project = options[itemKey];
        let workingDir = project.workingDir;

        // use first platform/config release
        let commands = [];
        if ('commands' in project && platform0 in project.commands)
            commands = project.commands[platform0][config0];


        for(let i in commands)
        {
            const command = commands[i];
            const source = command.source;
            const filePath = path.join(workingDir, source);

            let files = glob.sync(filePath);

            for(let fileI in files)
            {
                const file = files[fileI];
                let cwd = path.dirname(file);
                if (command.cwd)
                    cwd = command.cwd;

                let cmd = command.cmd;

                //dirname replacement
                cwd = cwd.replace(new RegExp('\\${DIRNAME}', 'g'), path.dirname(file));
                cmd = cmd.replace(new RegExp('\\${DIRNAME}', 'g'), path.dirname(file));

                //absolute replacement
                cwd = cwd.replace(new RegExp('\\${ABSOLUTEPATH}', 'g'), path.resolve(file));
                cmd = cmd.replace(new RegExp('\\${ABSOLUTEPATH}', 'g'), path.resolve(file));

                //filename replacement
                let relativeFilePath = path.relative(cwd, file);
                cwd = cwd.replace(new RegExp('\\${FILENAME}', 'g'), relativeFilePath);
                cmd = cmd.replace(new RegExp('\\${FILENAME}', 'g'), relativeFilePath);

                //basename replacement
                cwd = cwd.replace(new RegExp('\\${BASENAME}', 'g'), path.basename(file));
                cmd = cmd.replace(new RegExp('\\${BASENAME}', 'g'), path.basename(file));

                Logging.log(`running command: "${cmd}"`);

                const res = await runExecutable(cmd, cwd);

                if (!res)
                    return false;
            }
        }
    }

    return true;
}

async function runExecutable(cmd, cwd = null)
{
    const p = new Exec(`${cmd}`, cwd);
    p.on('stdout', out => Logging.log(out.trimRight()));
    p.on('stderr', out => Logging.log(out.trimRight()));
    p.on('error', out => Logging.error(out));

    return await p.waitForExit();
}


module.exports = commands;
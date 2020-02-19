const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const Logging = require('./logging');

let MakeHelper =
{
    async runHook(command, workingDir)
    {
        workingDir = path.resolve(workingDir);

        try
        {
            const { stdout, stderr } = await exec(command, {cwd: workingDir});
            Logging.log(stdout.trim());
            if (stderr && stderr.trim())
                Logging.error(stderr.trim());
        }
        catch(e)
        {
            Logging.error('"' + command + '" failed');
            throw Error("hook failed");
        }
    }
};


module.exports = MakeHelper;
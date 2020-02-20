const path = require('path');
const fs = require('fs');
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
    },

    findMsBuild()
    {
        if (process.env.vsInstallDir !== undefined) 
        {
            if (fs.existsSync(process.env.vsInstallDir))
                return process.env.vsInstallDir;
            else
                Logging.warning('vsInstallDir env is set but the directory does not exist');
        }

        const basePath = path.join(process.env['ProgramFiles(X86)'], 'Microsoft Visual Studio');
        const postPath = 'MSBuild/Current/Bin/MSBuild.exe'

        if (!fs.existsSync(basePath))
            return null;

        //const variations = ['Professional', 'Enterprise', 'Community', 'BuildTools'];

        const versions = fs.readdirSync(basePath);
        versions.sort((a, b) => {return b-a});
        
        //check all possibilites
        for(let i in versions)
        {
            const version = versions[i];
            const variations = fs.readdirSync(path.join(basePath, version));

            for(let v in variations)
            {
                const variation = variations[v];

                let possiblePath = path.join(basePath, version, variation, postPath);

                if (fs.existsSync(possiblePath))
                    return possiblePath;
            }
        }

        return null
    }
};


module.exports = MakeHelper;
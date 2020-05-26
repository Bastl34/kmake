const path = require('path');
const fs = require('fs');
const os = require('os');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const Logging = require('./logging');
const Globals = require('../globals');
const Exec = require('./exec');

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

    async findBuildTool()
    {
        // ************ windows ***********
        if (os.platform() == 'win32')
        {
            // visual studio
            const vs = this.findMsBuild();
            if (vs)
                return 'vs';

            // minGW
            const found = await (new Exec(`${Globals.DEFAULT_BUILD_SETTINGS.MK_MAKE} -v`)).waitForExit();

            if (found)
                return 'mk';
        }
        // ************ mac ***********
        else if (os.platform() == 'darwin')
        {
            // Xcode
            let found = await (new Exec(`xcodebuild -version`)).waitForExit();

            if (found)
                return 'xcode';

            // clang / make
            found = await (new Exec(`clang --version`)).waitForExit();

            if (found)
                return 'mk';
        }
        // ************ linux ***********
        else if (os.platform() == 'linux')
        {
            // gcc / make
            const found = await (new Exec(`gcc --version`)).waitForExit();

            if (found)
                return 'mk';
        }

        return ''
    },

    async checkBuildTool(templateName, options)
    {
        const template = Globals.TEMPLATES[templateName] || templateName;

        // ************ visual studio ***********
        if (template.indexOf('vs') === 0 && os.platform() == 'win32')
        {
            return !!this.findMsBuild();
        }
        // ************ xcode ***********
        else if (template.indexOf('xcode') === 0 && os.platform() == 'darwin')
        {
            return !!(await (new Exec(`xcodebuild -version`)).waitForExit());
        }
        // ************ makefile ***********
        else if (template == 'makefile')
        {
            let CCs = new Set();
            let MAKEs = new Set();

            for(let i in options.workspace.content)
            {
                let project = options[options.workspace.content[i]];
                CCs.add(this.getMKCC(project));
                MAKEs.add(this.getMake(project));
            }

            for (let cc of CCs)
            {
                const res = !!(await (new Exec(`${cc} --version`)).waitForExit());
                if (!res)
                    return false;
            }

            for (let mk of MAKEs)
            {
                const res = !!(await (new Exec(`${mk} --version`)).waitForExit());
                if (!res)
                    return false;
            }

            //if make tool and compiler found -> return true
            return true;
        }

        return null;
    },

    findMsBuild()
    {
        if (process.env.vsInstallDir !== undefined)
        {
            if (fs.existsSync(process.env.vsInstallDir))
                return process.env.vsInstallDir;

            Logging.warning('vsInstallDir env is set but the directory does not exist');
        }

        const basePath = path.join(process.env['ProgramFiles(X86)'], 'Microsoft Visual Studio');
        const postPath = 'MSBuild/Current/Bin/MSBuild.exe';

        if (!fs.existsSync(basePath))
            return null;

        //const variations = ['Professional', 'Enterprise', 'Community', 'BuildTools'];

        const versions = fs.readdirSync(basePath);
        versions.sort((a, b) => { return b - a; });

        // check all possibilites
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

        return null;
    },

    getMake(project)
    {
        let make = Globals.DEFAULT_BUILD_SETTINGS.MK_MAKE;

        if (project.settings && 'MK_MAKE' in project.settings)
            make = project.settings['MK_MAKE'];

        return make;
    },

    getMKCC(project)
    {
        let cc = Globals.DEFAULT_BUILD_SETTINGS.MK_CC;

        if (project.settings && 'MK_CC' in project.settings)
            cc = project.settings['MK_CC'];

        return cc;
    },

    findBuildProject(options)
    {
        // if build project is set
        if (options.buildProject)
        {
            if (!(options.buildProject in options))
            {
                throw Error('project ' + options.buildProject + ' not found');
            }
            return options.buildProject;
        }

        // find main project
        if (!('workspace' in options))
            throw Error('workspace not found');

        if (!('content' in options.workspace))
            throw Error('workspace has no content');

        // sort projects by type
        let projects = [...options.workspace.content];

        // sort projects by output type -> to find the best matching project -> see globals -> PROJECT_TYPES for sorting order
        projects.sort((a, b) =>
        {
            let aType = options[a]['outputType'];
            let bType = options[b]['outputType'];

            let aValue = Globals.PROJECT_TYPES[aType];
            let bValue = Globals.PROJECT_TYPES[bType];

            return aValue - bValue;
        });

        if (projects.length > 0)
            return projects[0];

        throw Error('no build project found');
    }
};


module.exports = MakeHelper;
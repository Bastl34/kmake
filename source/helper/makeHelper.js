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
                CCs.add(this.getMKCC(options, project));
                MAKEs.add(this.getMake(options, project));
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

        const basePath32 = path.join(process.env['ProgramFiles(X86)'], 'Microsoft Visual Studio');
        const basePath64 = path.join(process.env['ProgramFiles'], 'Microsoft Visual Studio');
        const postPath = 'MSBuild/Current/Bin/MSBuild.exe';

        if (!fs.existsSync(basePath32) || !fs.existsSync(basePath64))
            return null;

        const versions32 = fs.readdirSync(basePath32).map(item => path.join(basePath32, item));
        const versions64 = fs.readdirSync(basePath64).map(item => path.join(basePath64, item));

        let versions = [...versions32, ...versions64];

        versions.sort((a, b) =>
        {
            const basenameA = path.basename(a);
            const basenameB = path.basename(b);

            return basenameB.localeCompare(basenameA);
        });

        // check all possibilites
        for(let i in versions)
        {
            const version = versions[i];
            const variations = fs.readdirSync(version);

            for(let v in variations)
            {
                const variation = variations[v];

                let possiblePath = path.join(version, variation, postPath);

                if (fs.existsSync(possiblePath))
                    return possiblePath;
            }
        }

        return null;
    },

    getMake(options, project)
    {
        let make = options.build.MK_MAKE;

        if (Globals.DEFAULT_BUILD_SETTINGS.MK_MAKE == make && project.settings && 'MK_MAKE' in project.settings)
            make = project.settings['MK_MAKE'];

        return make;
    },

    getMKCC(options, project)
    {
        let cc = options.build.MK_CC;

        if (Globals.DEFAULT_BUILD_SETTINGS.MK_CC == cc && project.settings && 'MK_CC' in project.settings)
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
    },

    findPath(lib, libPaths, workingDir)
    {
        let libPath = path.join(workingDir, lib);
        if (fs.existsSync(libPath))
            return libPath;

        for(let i in libPaths)
        {
            libPath = path.join(libPaths[i], lib);

            if (!path.isAbsolute(libPath))
                libPath = path.join(workingDir, libPath);

            if (fs.existsSync(libPath))
                return libPath;
        }

        return lib;
    }

};


module.exports = MakeHelper;
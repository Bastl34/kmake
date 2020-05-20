const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');
const readlineSync = require('readline-sync');
const os = require('os');
const crypto = require('crypto');
const util = require('util');
const dmg = require('dmg');
const copy = require('recursive-copy');
const decompress = require('decompress');

const Helper = require('./helper/helper');
const FileHelper = require('./helper/fileHelper');
const NetHelper = require('./helper/netHelper');
const ImageHelper = require('./helper/imageHelper');
const Logging = require('./helper/logging');
const Exec = require('./helper/exec');

const Globals = require('./globals');
const ymlLoader = require('./ymlLoader');
const platformResolver = require('./platformResolver');

const kmakeRoot = fs.realpathSync(__dirname + '/..');

const dmgMount = util.promisify(dmg.mount);
const dmgUnmount = util.promisify(dmg.unmount);
const mkdirProm = util.promisify(fs.mkdir);

async function getAndApplyOptions(args)
{
    // ******************** find yaml ********************
    if (fs.existsSync(args.project) && !fs.statSync(args.project).isFile())
    {
        args.project += '/kmake.yml' ;

        if (!fs.existsSync(args.project) && args.defaultConfig)
        {
            args.project = path.join(kmakeRoot, '/resources/defaultConfig.yml');
            Logging.info('using default config..');
        }

        fileStat = null;
        try { fileStat = fs.statSync(args.project); }
        catch(e) {}

        if (!fileStat || !fileStat.isFile())
        {
            Logging.error('kmake.yaml not found (use --defaultConfig to use the default config)');
            process.exit();
        }
    }


    // ******************** find template ********************
    args.template = args.template.toLocaleLowerCase();
    if (!(args.template in Globals.TEMPLATES))
    {
        Logging.error('template: ' + args.template + ' not found');
        process.exit();
    }

    args.template = Globals.TEMPLATES[args.template];

    let templatePath = kmakeRoot + '/' + Globals.TEMPLATE_DIR +  '/' + args.template;
    if(path.isAbsolute(args.template))
        templatePath = args.template;

    try
    {
        let fileStat = fs.statSync(templatePath);
        if (!fileStat.isDirectory())
        {
            Logging.error('template: ' + args.template + ' not found');
            process.exit();
        }
    }
    catch(e)
    {
        Logging.error('template: ' + args.template + ' not found');
        process.exit();
    }


    // ******************** find output ********************
    let outputPath = kmakeRoot + '/' + args.output;
    if(path.isAbsolute(args.output))
        outputPath = args.output;


    // ******************** load yaml ********************
    let options = {};
    Logging.info('loading build settings...');
    try
    {
        options = ymlLoader(args.project, args.projectDir);
    } catch (e)
    {
        Logging.error(e);
        process.exit();
    }


    // ******************** build settings ********************
    options.build =
    {
        ...args,
        templatePath: FileHelper.normalize(templatePath),
        projectPath: FileHelper.normalize(args.project),
        outputPath: FileHelper.normalize(outputPath)
    };


    // ******************** apply workspace settings to build settings ********************
    if ('settings' in options.workspace)
    {
        for(let key in options.workspace.settings)
        {
            let item = options.workspace.settings[key];

            // not not overwrite if the setting was set by commandline params
            if (key in Globals.ARG_OPTIONS_DEFAULT && JSON.stringify(options.build[key]) == JSON.stringify(Globals.ARG_OPTIONS_DEFAULT[key]))
                options.build[key] = item;
        }

        // apply verbose setting
        Logging.setVerbose(options.build.verbose);
    }


    // ******************** get inputs ********************
    Logging.info('getting input data...');
    if ('inputs' in options)
    {
        try
        {
            // save input cache
            let inputCachePath = path.join(args.projectDir, Globals.CACHE_FILES.INPUT);

            let inputCache = {};

            if (fs.existsSync(inputCachePath))
                inputCache = ymlLoader(inputCachePath, args.projectDir);

            if (!args.useInputCache)
            {
                for(let key in options.inputs)
                {
                    let inputVar = options.inputs[key];

                    let nameStr = inputVar + ': ';
                    if (inputVar in inputCache)
                        nameStr = inputVar + ' (' + inputCache[inputVar] + '): ';

                    // read value
                    let value = readlineSync.question(nameStr);

                    if (!value && inputVar in inputCache)
                        value = inputCache[inputVar];

                    if (value)
                    {
                        options.inputs[inputVar] = value;
                        inputCache[inputVar] = value;
                    }

                    Logging.log(' --> ' + value);
                }
            }
            else
            {
                for(let key in options.inputs)
                {
                    let inputVar = options.inputs[key];

                    // read value from cache
                    let value = null;
                    if (inputVar in inputCache)
                        value = inputCache[inputVar];

                    Logging.log(inputVar + ': ' + value);
                }
            }

            // saving input data
            let dump = yaml.safeDump(inputCache);
            fs.writeFileSync(inputCachePath, dump);
        }
        catch(e)
        {
            Logging.error('error reading input variables ');
            Logging.log(e);
            process.exit();
        }
    }


    // ******************** apply command line data (defines, libs) to all projects ********************
    Logging.info('apply command line defines, libs, headerPath, libPath to each project...');

    const commandLineOptionMapping =
    [
        {cmdKey: 'define', projectKey: 'defines'},
        {cmdKey: 'lib', projectKey: 'dependencies'},
        {cmdKey: 'includePath', projectKey: 'includePaths'},
        {cmdKey: 'libPath', projectKey: 'libPaths'}
    ];

    for(let i in options.workspace.content)
    {
        let optionKey = options.workspace.content[i];
        let project = options[optionKey];

        if (Globals.MAIN_CONFIG_ITEMS.indexOf(optionKey) === -1)
        {
            commandLineOptionMapping.forEach(item =>
            {
                if (!(item.projectKey in project))
                    project[item.projectKey] = [];

                if (item.cmdKey in args)
                    project[item.projectKey] = [...project[item.projectKey], ...args[item.cmdKey]];
            });
        }
    }


    // ******************** run checks ********************
    Logging.info('running checks...');
    const checkResults = await runChecks(options);

    for(let i in options.workspace.content)
    {
        let optionKey = options.workspace.content[i];
        let project = options[optionKey];
        let isProject = Globals.MAIN_CONFIG_ITEMS.indexOf(optionKey) === -1;

        if (isProject)
        {
            if (!('defines' in project))
                project.defines = [];

            project.defines = [...project.defines, ...checkResults];
        }
    }


    // ******************** process env variables ********************
    Logging.info('replacing env variables...');
    Helper.recursiveReplace(options, (key, object) =>
    {
        if (typeof object === "string")
        {
            for(let varName in process.env)
            {
                varName = varName.toUpperCase();

                let replacement = '\\${ENV:' + varName + '}';
                let regex = new RegExp(replacement, 'g');
                object = object.replace(regex, process.env[varName]);
            }
        }

        return object;
    });


    // ******************** process local variables ********************
    Logging.info('replacing local variables...');
    Helper.recursiveReplace(options, (key, object) =>
    {
        if (typeof object === "string")
        {
            for(let varName in options.variables)
            {
                let replacement = '\\${' + varName + '}';
                let regex = new RegExp(replacement, 'g');
                object = object.replace(regex, options.variables[varName]);
            }
        }

        return object;
    });


    // ******************** process global variables ********************
    Logging.info('replacing global variables...');

    for(let optionKey in options)
    {
        let project = options[optionKey];

        let replacements = {};

        // ********** WORKING_DIR
        if ('workingDir' in project)
        {
            let workingDirAbsolute = FileHelper.normalize(path.resolve(project.workingDir));
            replacements['WORKING_DIR'] = workingDirAbsolute;
            replacements['WORKING_DIR_BACKSLASH'] = path.normalize(workingDirAbsolute);
        }

        // ********** OUTPUT_DIR_ABSOLUTE
        let outputDirAbsolute = path.resolve(options.build.outputPath);

        replacements['OUTPUT_DIR'] = outputDirAbsolute;
        replacements['OUTPUT_DIR_BACKSLASH'] = path.normalize(outputDirAbsolute);

        // ********** PROJECT_NAME
        replacements['PROJECT_NAME'] = optionKey;

        // replace
        Helper.recursiveReplace(project, (key, object) =>
        {
            if (typeof object === "string")
            {
                for(let varName in replacements)
                {
                    let replacement = '\\${' + varName + '}';
                    let regex = new RegExp(replacement, 'g');
                    object = object.replace(regex, replacements[varName]);
                }
            }

            return object;
        });
    }


    // ******************** apply workspace settings to each project ********************
    Logging.info('processing workspace settings...');
    for(let i in options.workspace.content)
    {
        let project = options.workspace.content[i];

        for(let settingsKey in options.workspace.settings)
        {
            if (!(project in options))
                continue;

            if (!('settings' in options[project]))
                options[project].settings = {};

            // apply only if there is no project specific overwrite
            if (!(settingsKey in options[project].settings))
                options[project].settings[settingsKey] = options.workspace.settings[settingsKey];
        }
    }


    // ******************** add workspace dependencie paths to project's  ********************
    Logging.info('appending workspace dependencies to includePaths ...');
    //let depenencyItems = ['includePaths', 'libPaths'];
    let depenencyItems = ['includePaths'];

    for(let optionKey in options)
    {
        let project = options[optionKey];

        if ('dependencies' in project)
        {
            for(let dependencyKey in project.dependencies)
            {
                let dependency = project.dependencies[dependencyKey];

                if (dependency in options && 'workingDir' in options[dependency])
                {
                    depenencyItems.forEach(depenencyItem =>
                    {
                        if (!(depenencyItem in project))
                            project[depenencyItem] = [];

                        let relativePath = FileHelper.relative(project.workingDir, options[dependency].workingDir);

                        project[depenencyItem].push(relativePath);
                    });
                }
            }
        }
    }


    // ******************** add additional defines to each project ********************
    Logging.info('add additional defines to each project...');
    Logging.info(' - PROJECT_NAME, PROJECT_[PROJECT_NAME], ASSET_DIR, PROJECT_PATH');

    for(let i in options.workspace.content)
    {
        let optionKey = options.workspace.content[i];
        let project = options[optionKey];
        let isProject = Globals.MAIN_CONFIG_ITEMS.indexOf(optionKey) === -1;

        if (isProject)
        {
            if (!('defines' in project))
                project.defines = [];

            project.defines.push({'PROJECT_NAME': '"' + optionKey + '"'});

            project.defines.push('PROJECT_' + optionKey.toUpperCase());

            // this is the relative path based on the execution file
            let assetDir = Globals.ASSET_DIRS_BY_TEMPLATE[args.template];
            if (typeof assetDir !== "string")
            {
                if (project.outputType in assetDir)
                    assetDir = assetDir[project.outputType];
                else if ('generic' in assetDir)
                    assetDir = assetDir['generic'];
                else
                    throw Error("can not find asset dir for outputType");
            }

            project.defines.push({'ASSET_DIR': '"' + FileHelper.normalize(assetDir) + '"'});

            // absolute path to project
            project.defines.push({'PROJECT_PATH': '"' + FileHelper.resolve(project.workingDir + '"')});
        }
    }


    // ******************** resolve platforms/architectures ********************
    Logging.info('resolving platform specific settings...');
    options = platformResolver(options, options.build);


    // ******************** download ********************
    Logging.info('downloading...');
    await download(options);


    // ******************** resolve source files ********************
    Logging.info('resolving source files...');
    for(let itemKey in options)
    {
        let item = options[itemKey];
        if ('sources' in item)
        {
            let sources = [];

            let workingDir = item.workingDir;

            item.sourcesBase = [...item.sources];

            for(let key in item.sources)
            {
                let file = item.sources[key];
                let filePath = workingDir + '/' + file;
                let files = glob.sync(filePath);

                files = files.map(file => { return FileHelper.normalize(file); });
                sources = [...sources, ...files];
            }

            item.sources = sources;
        }
    }


    // ******************** resolve dependency files ********************

    // this is basicly the same as the next part
    // but for dependencies it could be that they are from the workspace -> so an extra check is needed
    Logging.info('resolving dependency files...');
    for(let itemKey in options)
    {
        let item = options[itemKey];
        if ('dependencies' in item)
        {
            Helper.recursiveReplace(item.dependencies, (key, object) =>
            {
                if (typeof object === "string")
                {
                    // only resolve paths for items not in workspace
                    if (options.workspace.content.indexOf(object) == -1)
                    {
                        let filePath = item.workingDir + '/' + object;

                        // only resolve libs with paths
                        if (fs.existsSync(filePath))
                            object = FileHelper.normalize(filePath);
                    }
                }

                return object;
            });
        }
    }


    // ******************** resolve platform specific paths ********************
    Logging.info('resolving platform/arch/config specific paths...');

    let resolvingItems = ['includePaths', 'libPaths'];

    for(let i in options.workspace.content)
    {
        let optionKey = options.workspace.content[i];
        let option = options[optionKey];

        for(let propKey in option)
        {
            let property = option[propKey];

            // only for resolvingItems items
            if (resolvingItems.indexOf(propKey) != -1)
            {
                Helper.recursiveReplace(property, (key, object) =>
                {
                    if (typeof object === "string" && !path.isAbsolute(object))
                    {
                        let filePath = option.workingDir + '/' + object;
                        object = FileHelper.normalize(filePath);
                    }

                    return object;
                });
            }
        }
    }


    // ******************** resolve arch ********************
    Logging.info('resolving build archs...');

    if (options.build.arch.length == 0)
    {
        options.build.arch = Globals.ARCHS[options.build.template];
        Logging.info(' - ' + options.build.arch.join(','));
    }

    // ******************** resolve single asset entry ********************
    Logging.info('resolving single asset entries...');

    for(let itemKey in options)
    {
        let item = options[itemKey];
        if ('assets' in item)
        {
            if (typeof item.assets == 'string')
            {
                item.assets =
                [{
                    source: item.assets,
                    destination: ''
                }];
            }
        }
    }

    return options;
}

async function download(options)
{
    let downloadList = {}

    // check projects and goup
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        if ('downloads' in options[projectName])
        {
            for (let archKey in options[projectName].downloads)
            {
                for (let config in options[projectName].downloads[archKey])
                {
                    for (let i in options[projectName].downloads[archKey][config])
                    {
                        let dl = options[projectName].downloads[archKey][config][i];
                        dl.workingDir = options[projectName].workingDir;

                        let dlKey = Helper.sha265(JSON.stringify(dl));
                        downloadList[dlKey] = dl;
                    }
                }
            }
        }
    }

    // save download cache
    let cachePath = path.join(options.build.projectDir, Globals.CACHE_FILES.DOWNLOAD);
    let cache = {};

    if (fs.existsSync(cachePath) && options.build.useDownloadCache)
        cache = yaml.safeLoad(fs.readFileSync(cachePath, 'utf8'));

    for (let i in downloadList)
    {
        let dl = downloadList[i];

        if (options.build.useDownloadCache && cache[i] && fs.existsSync(dl.dest))
            continue;

        let size = 0;
        try { size = await NetHelper.getDownloadSize(dl.url); } catch(e) { Logging.warning('can not get download size') };

        Logging.info('downloading: ' + dl.url + ' (' + Helper.bytesToSize(size) +  ') ...');

        await mkdirProm(path.dirname(dl.dest), {recursive: true});
        await NetHelper.download(dl.url, dl.dest);

        // hash check
        let hashAlgos = crypto.getHashes();
        for(let key in dl)
        {
            if (hashAlgos.includes(key))
            {
                Logging.info(`checking ${key} hash ${dl[key]} ...`);

                let hash = await Helper.fileHash(dl.dest, key);

                if (hash != dl[key])
                {
                    Logging.error('hash check failed got: ' + hash + ' but should be ' + dl[key]);
                    process.exit(0);
                }

                Logging.info('hash checked');
            }
        }

        // post cmd's
        if (dl.postCmds)
        {
            for(let cmdI in dl.postCmds)
            {
                let cmd = dl.postCmds[cmdI];

                if (cmd.convertTo)
                {
                    Logging.info('converting to: ' + cmd.convertTo + ' ...');

                    await ImageHelper.convert(dl.dest, cmd.convertTo);
                    Logging.info('image converted');
                }

                if (cmd.extractTo)
                {
                    Logging.info('extracting to: ' + cmd.extractTo + ' ...');

                    let files = await extract(dl.dest, cmd.extractTo);
                    Logging.info(files.length + ' extracted');
                }

                if (cmd.cmd)
                {
                    Logging.info(`running cmd: ${cmd.cmd} ...`);

                    const p = new Exec(cmd.cmd, dl.workingDir);
                    p.on('stdout', out => Logging.log(out.trimRight()));
                    p.on('stderr', out => Logging.log(out.trimRight()));
                    p.on('error', out => Logging.error(out));
                    p.on('exit', code => Logging.log('exit with code: ' + code));

                    const res = await p.waitForExit();
                    Logging.info('cmd: ' + res);
                }
            }
        }

        cache[i] = true;
    }

    // save cache
    let dump = yaml.safeDump(cache);
    fs.writeFileSync(cachePath, dump);
}

async function extract(file, extractTo)
{
    let files = 0;

    let ext = path.extname(file);

    if (ext == '.dmg')
    {
        if (os.platform() != 'darwin')
            throw Error('dmg extracting is not supported on your platform');

        let volume = await dmgMount(file);
        files = await copy(volume, extractTo, {overwrite: true});
        await dmgUnmount(volume);
    }
    else
        files = await decompress(file, extractTo);

    return files
}

async function runChecks(options)
{
    const tempDir = Globals.TEMP_DIRS.check;
    const fileName = "check.cpp";

    let result = [];

    // save download cache
    let cachePath = path.join(options.build.projectDir, Globals.CACHE_FILES.CHECK);
    let cache = {};

    if (fs.existsSync(cachePath) && options.build.useDownloadCache)
        cache = yaml.safeLoad(fs.readFileSync(cachePath, 'utf8'));

    if ('checks' in options)
    {
        for(let name in options.checks)
        {
            const check = options.checks[name];

            let hash = Helper.sha265(JSON.stringify({name, check}));

            let res = false;

            if (options.build.useCheckCache && cache[hash])
            {
                res = cache[hash]
                Logging.log(name + ': ' + res + ' (cached)');
            }
            else
            {
                // prepare data dir
                if (fs.existsSync(tempDir))
                    await fs.promises.rmdir(tempDir, {recursive: true});
                await fs.promises.mkdir(tempDir);

                // copy content
                const checkFilePath = path.resolve(path.join(options.build.projectDir, check));
                const tmpFile = path.resolve(path.join(tempDir, fileName));

                if (fs.existsSync(checkFilePath))
                    fs.copyFileSync(checkFilePath, tmpFile);
                else
                    fs.writeFileSync(tmpFile, check);

                // execute
                res = await (new Exec(`node kmake.js ${tempDir} --run --useInputCache --verbose 0`)).waitForExit();
                Logging.log(name + ': ' + res);
            }

            let obj = {};
            obj[name] = res;
            result.push(obj);

            cache[hash] = true;
        }
    }

    // save cache
    let dump = yaml.safeDump(cache);
    fs.writeFileSync(cachePath, dump);

    return result;
}

module.exports = getAndApplyOptions;
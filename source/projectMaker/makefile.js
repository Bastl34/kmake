const path = require('path');
const fs = require('fs');
const os = require('os');

const copy = require('recursive-copy');
const replace = require('replace-in-file');
const plist = require('plist');
const escapeHtml = require('escape-html');

const Helper = require('../helper/helper');
const FileHelper = require('../helper/fileHelper');
const MakeHelper = require('../helper/makeHelper');
const Logging = require('../helper/logging');


const Globals = require('../globals');

const OUTPUT_TYPE_MAP =
{
    'app': 'main',
    'framework': 'dynamic'
};

const HEADERS =
[
    '.h',
    '.hpp'
];

const OUTPUT_BY_TYPE =
{
    'static': '.a',
    'dynamic': os.platform() == 'darwin' ? '.dylib' : '.so',
    'main': '',
};

function getDefineEntry(item)
{
    if (!item)
        return "";

    if (item instanceof Object)
    {
        let name = Object.keys(item)[0];

        let isStr = typeof item[name] === 'string';
        if (isStr)
            return name + '=\'' + item[name] + '\'';
        else
            return name + '=' + item[name];
    }
    else
        return item;
}

function getTargetKey(projectName, template, archIndex, configIndex)
{
    return projectName + "_" + Globals.ARCHS[template][archIndex] + '_' + Globals.CONFIGURATIONS[configIndex];
}

function getBinDir(platform, config)
{
    return path.join(Globals.DEFAULT_BIN_DIR, platform, config);
}


async function makeMakefile(options)
{
    // ******************** copy projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        let outputType = project.outputType;
        if (outputType in OUTPUT_TYPE_MAP)
            outputType = OUTPUT_TYPE_MAP[outputType];

        let sourcePath = options.build.templatePath + '/' + outputType + '.mk';
        let destPath = options.build.outputPath + '/' + projectName + '.mk';

        await copy(sourcePath, destPath, {overwrite: true});
    }


    // ******************** generate Makefile ********************
    Logging.log('generating Makefile');
    let sourcePath = options.build.templatePath + '/framework.mk';
    let destPath = options.build.outputPath + '/Makefile';

    await copy(sourcePath, destPath, {overwrite: true});

    let includeStr = '';
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        includeStr += projectName + '.mk ';
    }

    await replace({files: destPath, from: '#INCLUDES#', to: includeStr.trim()});


    // ******************** generate projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        if (project.type != 'project' && project.projectType != 'source')
            continue;

        Logging.info('========== ' + projectName + ' ==========');

        // ********** beforePrepare hook

        //use x86_64 release
        if (Helper.hasKeys(project, 'hooks', 'beforePrepare', 'x86_64', 'release'))
        {
            for(let i in project.hooks.beforePrepare.x86_64.release)
            {
                let hook = project.hooks.beforePrepare.x86_64.release[i];
                await MakeHelper.runHook(hook, project.workingDir);
            }
        }

        let objectList = [];
        let sourceFileContent = '';
        project.sources.forEach(file =>
        {
            //do not process headers
            if (HEADERS.indexOf(path.extname(file)) != -1)
                return;

            let filePathRelative = file;
            if (project.workingDir && project.workingDir.length > 0)
                filePathRelative = filePathRelative.substr(project.workingDir.length + 1);

            //get the relative path from output dir to source
            let absolutePath = path.resolve(file);
            let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + path.basename(file);

            let outPath = path.join(Globals.DEFAULT_OBJECTS_DIR, relativePath.replace(/\.\.\//g, '')) + '.o';
            let outDir = path.dirname(path.join(options.build.outputPath,outPath));

            //create all output dirs
            fs.mkdirSync(outDir, { recursive: true });

            sourceFileContent += `${outPath}:\n`;
            sourceFileContent += `	$(CC) $(PRE_FLAGS) ${relativePath} -c -o ${outPath} $(POST_FLAGS)\n\n`;

            objectList.push(outPath)
        });


        //platform specific targets
        let targets = ''
        for(let platformI in Globals.ARCHS[options.build.template])
        {
            let platform = Globals.ARCHS[options.build.template][platformI];

            for(let configI in Globals.CONFIGURATIONS)
            {
                let config = Globals.CONFIGURATIONS[configI];

                let targetKey = getTargetKey(projectName, options.build.template, platformI, configI);
                let preBuildHook = targetKey + '_preBuild';
                let postBuildHook = targetKey + '_postBuild';
                let copyTarget = targetKey + '_copy';

                let outputType = project.outputType;
                if (outputType in OUTPUT_TYPE_MAP)
                    outputType = OUTPUT_TYPE_MAP[outputType];

                let outDir = getBinDir(platform, config);
                let outPath = path.join(outDir, projectName + OUTPUT_BY_TYPE[outputType]);
                let outPathAbsolute = path.resolve(path.join(options.build.outputPath, outPath))


                //dependencies
                let libsContent = '';
                let libsArray = ('dependencies' in project) ? project['dependencies'][platform][config] : [];
                libsArray.forEach(lib =>
                {
                    if (lib in options)
                    {
                        let libOutputType = options[lib].outputType;
                        if (libOutputType in OUTPUT_BY_TYPE)
                            libOutputType = OUTPUT_BY_TYPE[libOutputType];

                        libsContent += ' ' + path.join(outDir, lib + libOutputType);
                    }
                    else
                    {
                        if (fs.existsSync(lib))
                        {
                            pathRelative = FileHelper.relative(options.build.outputPath, lib);
                            libsContent += ' ' + pathRelative;
                        }
                        else
                            libsContent += ' -l' + lib;
                    }
                });

                //create all output dirs
                fs.mkdirSync(path.dirname(outPathAbsolute), { recursive: true });

                targets += targetKey + '_build: ' + preBuildHook + ' ' + objectList.join(' ') + '\n';

                if (outputType == 'static')
                    targets += `	$(AR) $(ARFLAGS) ${outPath} ${objectList.join(' ')}\n\n`;
                else
                    targets += `	$(CC) $(PRE_FLAGS) ${objectList.join(' ')} ${libsContent.trim()} -o ${outPath} $(POST_FLAGS)\n\n`;

                targets += targetKey + ': ' + targetKey + '_build ' + copyTarget + ' ' + postBuildHook + '\n';
            }
        }

        let defaultTarget = getTargetKey(projectName, options.build.template, 0, 0);

        // ********** replacements
        Logging.log('generating ' + projectName + '.mk');
        let projectFilePath = options.build.outputPath + '/' + projectName + '.mk';

        results = await replace({files: projectFilePath, from: '#DEFAULT_TARGET#', to: defaultTarget});
        results = await replace({files: projectFilePath, from: '#TARGETS#', to: targets});
        results = await replace({files: projectFilePath, from: '#SOURCE_FILE#', to: sourceFileContent.trim()});


        // ********** platform specific data
        Logging.log("applying platform data...");
        await applyPlatformData(projectName, project, options);

        // ********** apply settings
        Logging.log("applying project settings...");
        await applyProjectSettings(projectName, project, options);

        /*
        // ********** assets
        Logging.log("applying asset data...");
        await applyAssets(projectName, project, options);

        // ********** replacements
        Logging.log("applying replacements...");
        applyReplacements(projectName, project, options);
        */

        // ********** copy files
        Logging.log("applying file copy step...");
        await applyCopyStep(projectName, project, options);

        // ********** hooks
        Logging.log("applying hooks...");
        await applyHooks(projectName, project, options);

        // ********** afterPrepare hook
        //use x86_64 release
        if (Helper.hasKeys(project, 'hooks', 'afterPrepare', 'x86_64', 'release'))
        {
            for(let i in project.hooks.afterPrepare.x86_64.release)
            {
                let hook = project.hooks.afterPrepare.x86_64.release[i];
                await MakeHelper.runHook(hook, project.workingDir);
            }
        }
    }

    return true;
}

async function applyPlatformData(projectName, project, options)
{
    let projectFilePath = options.build.outputPath + '/' + projectName + '.mk';

    let includePathsContent = '';
    let definesContent = '';
    let libPathsContent = '';
    let buildFlagsContent = '';
    let linkerFlagsContent = '';

    for(let platformI in Globals.ARCHS[options.build.template])
    {
        let platform = Globals.ARCHS[options.build.template][platformI];

        for(let configI in Globals.CONFIGURATIONS)
        {
            let config = Globals.CONFIGURATIONS[configI];

            let targetKey = getTargetKey(projectName, options.build.template, platformI, configI);

            // ***** include
            includePathsContent += targetKey + ': INCLUDES += '
            let includesArray = ('includePaths' in project) ? project['includePaths'][platform][config] : [];
            includesArray.forEach(item =>
            {
                if (!path.isAbsolute(item))
                    item = FileHelper.relative(options.build.outputPath, item);
                includePathsContent += '-I' + item + ' ';
            });
            includePathsContent += '\n'

            // ***** defines
            definesContent += targetKey + ': DEFINES += '
            let definesArray = ('defines' in project) ? project['defines'][platform][config] : [];
            definesArray.forEach(item =>
            {
                definesContent += '-D' + getDefineEntry(item) + ' ';
            });
            definesContent += '\n'

            // ***** libPaths
            libPathsContent += targetKey + ': LIB_PATHS += '
            let libsPathsArray = ('libPaths' in project) ? project['libPaths'][platform][config] : [];
            libsPathsArray.forEach(item =>
            {
                if (!path.isAbsolute(item))
                    item = FileHelper.relative(options.build.outputPath, item);
                libPathsContent += '-L' + item + ' ';
            });

            libPathsContent += '-L' + getBinDir(platform, config) + ' ';
            libPathsContent += '\n'

            // ***** buildFlags
            buildFlagsContent += targetKey + ': CXXFLAGS += '
            let buildFlagsArray = ('buildFlags' in project) ? project['buildFlags'][platform][config] : [];
            buildFlagsArray.forEach(item =>
            {
                buildFlagsContent += item + ' ';
            });

            //append global config flags
            buildFlagsContent += '$(' + config.toUpperCase() + ')'
            buildFlagsContent += '\n'


            // ***** linkerFlags
            linkerFlagsContent += targetKey + ': LDFLAGS += '
            let linkerFlagsArray = ('linkerFlags' in project) ? project['linkerFlags'][platform][config] : [];
            linkerFlagsArray.forEach(item =>
            {
                linkerFlagsContent += item + ' ';
            });
            linkerFlagsContent += '\n'
        }
    }

    //apply
    await replace({files: projectFilePath, from: `#TARGET_INCLUDES#`, to: includePathsContent.trim()});
    await replace({files: projectFilePath, from: `#TARGET_DEFINES#`, to: definesContent.trim()});
    await replace({files: projectFilePath, from: `#TARGET_LIB_PATHS#`, to: libPathsContent.trim()});
    await replace({files: projectFilePath, from: `#TARGET_CXXFLAGS#`, to: buildFlagsContent.trim()});
    await replace({files: projectFilePath, from: `#TARGET_LDFLAGS#`, to: linkerFlagsContent.trim()});
}

async function applyProjectSettings(projectName, project, options)
{
    let files = [];

    files.push(options.build.outputPath + '/' + projectName + '.mk');

    files.map(file => path.resolve(file));

    for(let settingsKey in Globals.DEFAULT_BUILD_SETTINGS)
    {
        let val = Globals.DEFAULT_BUILD_SETTINGS[settingsKey];
        if ('settings' in project && settingsKey in project.settings)
            val = project.settings[settingsKey];

        if (val.indexOf('-') != 0 && val != "")
            val = '-' + val;

        await replace({files: files, from: new RegExp(`#${settingsKey}#`, 'g'), to: val.trim()});
    }

    return true;
}

async function applyHooks(projectName, project, options)
{
    let projectFilePath = options.build.outputPath + '/' + projectName + '.mk';

    let hooks = ['preBuild', 'postBuild'];

    let hookContent = '';

    for(let hookI in hooks)
    {
        let hookName = hooks[hookI];

        for(let platformI in Globals.ARCHS[options.build.template])
        {
            let platform = Globals.ARCHS[options.build.template][platformI];

            for(let configI in Globals.CONFIGURATIONS)
            {
                let config = Globals.CONFIGURATIONS[configI];
                let targetKey = getTargetKey(projectName, options.build.template, platformI, configI);
                let hookKey = targetKey + '_' + hookName;

                hookContent += hookKey + ':\n';

                if (Helper.hasKeys(project, 'hooks', hookName, platform, config))
                {
                    for(let i in project['hooks'][hookName][platform][config])
                    {
                        let hook = project['hooks'][hookName]['x86_64']['release'][i];
                        hookContent += `	${hook}\n`;
                    }

                    hookContent += '\n';
                }
            }
        }
    }

    results = await replace({files: projectFilePath, from: '#HOOKS#', to: hookContent.trim()});
}

async function applyCopyStep(projectName, project, options)
{
    let projectFilePath = options.build.outputPath + '/' + projectName + '.mk';

    let copyContent = '';

    for(let platformI in Globals.ARCHS[options.build.template])
    {
        let platform = Globals.ARCHS[options.build.template][platformI];

        for(let configI in Globals.CONFIGURATIONS)
        {
            let config = Globals.CONFIGURATIONS[configI];
            let targetKey = getTargetKey(projectName, options.build.template, platformI, configI);
            let copyKey = targetKey + '_copy';

            copyContent += copyKey + ':\n';

            let libsArray = ('dependencies' in project) ? project['dependencies'][platform][config] : [];
            libsArray.forEach(lib =>
            {
                if (!(lib in options))
                {
                    if (fs.existsSync(lib) && lib.indexOf(OUTPUT_BY_TYPE.dynamic) != -1)
                    {
                        let from = FileHelper.relative(options.build.outputPath, lib);
                        let to = path.join(getBinDir(platform, config), path.basename(from));

                        copyContent += `	cp -f ${from} ${to}\n`;
                    }
                }
            });
        }
    }

    results = await replace({files: projectFilePath, from: '#COPY#', to: copyContent.trim()});
}

module.exports = makeMakefile;
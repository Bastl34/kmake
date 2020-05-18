const path = require('path');
const fs = require('fs');
const os = require('os');

const copy = require('recursive-copy');
const replace = require('replace-in-file');

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

const SOURCE_MAP =
{

    '.c': 'c',
    '.C': 'c++',
    '.cc': 'c++',
    '.cpp': 'c++',
    '.CPP': 'c++',
    '.c++': 'c++',
    '.cp': 'c++',
    '.cxx': 'c++'
};

const LNG_FLAG_MAP =
{
    'c++': 'PROJECT_NAME_CXX_FLAGS',
    'c': 'PROJECT_NAME_C_FLAGS'
};

const OUTPUT_BY_TYPE =
{
    'static': '.a',
    'dynamic': os.platform() == 'darwin' ? '.dylib' : os.platform() == 'win32' ? '.dll' : '.so',
    'main': os.platform() == 'win32' ? '.exe' : '',
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

function getTargetKey(projectName, arch, archIndex, configIndex)
{
    return projectName + "_" + arch[archIndex] + '_' + Globals.CONFIGURATIONS[configIndex];
}

function getBinDir(platform, config)
{
    return FileHelper.join(Globals.DEFAULT_BIN_DIR, platform, config);
}

function getCC(project)
{
    let cc = Globals.DEFAULT_BUILD_SETTINGS.MK_CC;

    if (project.settings && 'MK_CC' in project.settings)
        cc = project.settings['MK_CC'];

    return cc;
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

    let includeStr = '';
    for(let i in projects)
    {
        let projectName = projects[i];

        includeStr += projectName + '.mk ';
    }

    if (includeStr)
        includeStr = 'include ' + includeStr;

    await replace({files: destPath, from: '#INCLUDES#', to: includeStr.trim()});

    // ******************** generate projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];
        let PROJECT_NAME = projectName.toUpperCase();

        Logging.info('========== ' + projectName + ' ==========');

        // ********** beforePrepare hook

        // use x86_64 release
        if (Helper.hasKeys(project, 'hooks', 'beforePrepare', 'x86_64', 'release'))
        {
            for(let i in project.hooks.beforePrepare.x86_64.release)
            {
                let hook = project.hooks.beforePrepare.x86_64.release[i];
                await MakeHelper.runHook(hook, project.workingDir);
            }
        }

        // ********** sources
        let objectList = [];
        let sourceFileContent = '';
        project.sources.forEach(file =>
        {
            // do not process headers
            if (HEADERS.indexOf(path.extname(file)) != -1)
                return;

            let filePathRelative = file;
            if (project.workingDir && project.workingDir.length > 0)
                filePathRelative = filePathRelative.substr(project.workingDir.length + 1);

            // get the relative path from output dir to source
            let absolutePath = FileHelper.resolve(file);
            let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + path.basename(file);
            let extname = path.extname(relativePath);

            let outPath = FileHelper.join(Globals.DEFAULT_OBJECTS_DIR, relativePath.replace(/\.\.\//g, '')) + '.o';
            let outDir = path.dirname(FileHelper.join(options.build.outputPath,outPath));

            // create all output dirs
            fs.mkdirSync(outDir, { recursive: true });

            let language = "";
            let languageSettings = "";
            if (extname in SOURCE_MAP)
            {
                let lng = SOURCE_MAP[extname];
                language = '-x ' + lng;

                if (lng in LNG_FLAG_MAP)
                    languageSettings = '$(' + LNG_FLAG_MAP[lng] + ')';
            }

            sourceFileContent += `${outPath}: ${relativePath}\n`;
            sourceFileContent += `	$(${PROJECT_NAME}_CC) $(${PROJECT_NAME}_PRE_FLAGS) ${languageSettings} ${language} ${relativePath} -c -o ${outPath} $(${PROJECT_NAME}_POST_FLAGS)\n\n`;

            objectList.push(outPath);
        });

        // ********** platform specific targets
        let targets = ''
        for(let platformI in options.build.arch)
        {
            let platform = options.build.arch[platformI];

            for(let configI in Globals.CONFIGURATIONS)
            {
                let config = Globals.CONFIGURATIONS[configI];

                let targetKey = getTargetKey(projectName, options.build.arch, platformI, configI);
                let preBuildHook = targetKey + '_preBuild';
                let postBuildHook = targetKey + '_postBuild';
                let copyTarget = targetKey + '_copy';
                let assetsKey = projectName + '_assets';
                let startKey = PROJECT_NAME + '_START';

                let outputType = project.outputType;
                if (outputType in OUTPUT_TYPE_MAP)
                    outputType = OUTPUT_TYPE_MAP[outputType];

                let outDir = getBinDir(platform, config);
                let outPath = FileHelper.join(outDir, projectName + OUTPUT_BY_TYPE[outputType]);
                let outPathAbsolute = FileHelper.resolve(FileHelper.join(options.build.outputPath, outPath));
                let outBaseName = path.basename(outPath);

                // dependencies
                let libsContent = '';
                let targetDepsContent = '';
                let libsArray = ('dependencies' in project) ? project['dependencies'][platform][config] : [];
                libsArray.forEach(lib =>
                {
                    if (lib in options)
                    {
                        let libOutputType = options[lib].outputType;
                        if (libOutputType in OUTPUT_BY_TYPE)
                            libOutputType = OUTPUT_BY_TYPE[libOutputType];

                        libsContent += ' ' + FileHelper.join(outDir, lib + libOutputType);
                        //libsContent += ' -L' + path.dirname(path.join(outDir, lib + libOutputType));
                        //libsContent += ' -l' + path.basename(lib);

                        targetDepsContent += getTargetKey(lib, options.build.arch, platformI, configI) + ' ';
                    }
                    else
                    {
                        if (fs.existsSync(lib))
                        {
                            let libAbsolute = FileHelper.resolve(lib);
                            pathRelative = FileHelper.relative(options.build.outputPath, libAbsolute);
                            libsContent += ' ' + pathRelative;
                        }
                        else
                            libsContent += ' -l' + lib;
                    }
                });

                // create all output dirs
                fs.mkdirSync(path.dirname(outPathAbsolute), { recursive: true });

                targets += targetKey + '_build: ' + startKey + ' ' + preBuildHook + ' ' + objectList.join(' ') + '\n';

                // set execution path for lib
                let installName = `-dynamiclib -install_name "@executable_path/${outBaseName}"`;
                if (os.platform() == 'linux')
                    installName = '-Wl,-soname,\'$$$$ORIGIN/'+outBaseName+'\'';
                else if (os.platform() == 'win32')
                    installName = '';

                if (outputType == 'static')
                    targets += `	$(AR) $(ARFLAGS) ${outPath} ${objectList.join(' ')}\n\n`;
                else if (outputType == 'dynamic')
                    targets += `	$(${PROJECT_NAME}_CC) $(${PROJECT_NAME}_PRE_FLAGS) ${objectList.join(' ')} ${libsContent.trim()} -o ${outPath} $(${PROJECT_NAME}_POST_FLAGS) ${installName}\n\n`;
                else
                    targets += `	$(${PROJECT_NAME}_CC) $(${PROJECT_NAME}_PRE_FLAGS) ${objectList.join(' ')} ${libsContent.trim()} -o ${outPath} $(${PROJECT_NAME}_POST_FLAGS)\n\n`;

                targets += targetKey + ': ' + targetDepsContent.trim() + ' ' + targetKey + '_build ' + copyTarget + ' ' + assetsKey + ' ' + postBuildHook + '\n';
            }
        }

        // ********** includes (makefile includes)
        let include = '';

        let platform0 = options.build.arch[0];
        let config0 = Globals.CONFIGURATIONS[0];

        let libsArray = ('dependencies' in project) ? project['dependencies'][platform0][config0] : [];
        libsArray.forEach(lib =>
        {
            if (lib in options)
                include = lib + '.mk ';
        });

        if (include)
            include = 'include ' + include;

        let defaultTarget = getTargetKey(projectName, options.build.arch, 0, 0);

        // ********** replacements
        Logging.log('generating ' + projectName + '.mk');
        let projectFilePath = options.build.outputPath + '/' + projectName + '.mk';

        results = await replace({files: projectFilePath, from: '#DEFAULT_TARGET#', to: defaultTarget});
        results = await replace({files: projectFilePath, from: '#TARGETS#', to: targets});
        results = await replace({files: projectFilePath, from: '#SOURCE_FILE#', to: sourceFileContent.trim()});
        results = await replace({files: projectFilePath, from: /PROJECT_NAME/g, to: projectName.toUpperCase()});
        results = await replace({files: projectFilePath, from: '#INCLUDES#', to: include.trim()});

        // ********** platform specific data
        Logging.log("applying platform data...");
        await applyPlatformData(projectName, project, options);

        // ********** apply settings
        Logging.log("applying project settings...");
        await applyProjectSettings(projectName, project, options);

        // ********** assets
        Logging.log("applying asset data...");
        await applyAssets(projectName, project, options);

        // ********** copy files
        Logging.log("applying file copy step...");
        await applyCopyStep(projectName, project, options);

        // ********** hooks
        Logging.log("applying hooks...");
        await applyHooks(projectName, project, options);

        // ********** afterPrepare hook
        // use x86_64 release
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
    let PROJECT_NAME = projectName.toUpperCase();

    let compilerContent = '';
    let includePathsContent = '';
    let definesContent = '';
    let libPathsContent = '';
    let buildFlagsContent = '';
    let linkerFlagsContent = '';

    for(let platformI in options.build.arch)
    {
        let platform = options.build.arch[platformI];

        for(let configI in Globals.CONFIGURATIONS)
        {
            let config = Globals.CONFIGURATIONS[configI];

            let targetKey = getTargetKey(projectName, options.build.arch, platformI, configI);

            // ***** compiler
            let cc = getCC(project);
            let platformName = platform;
            let platformFlags = ""

            if (cc in Globals.ARCHS_FLAG_MAP && platformName in Globals.ARCHS_FLAG_MAP[cc])
                platformFlags = Globals.ARCHS_FLAG_MAP[cc][platformName];

            if (cc in Globals.ARCHS_MAP && platformName in Globals.ARCHS_MAP[cc])
                platformName = Globals.ARCHS_MAP[cc][platformName];

            if (cc.indexOf("clang") != -1)
                compilerContent += targetKey + `: ${PROJECT_NAME}_CC += -arch ${platformName} ${platformFlags}\n`;
            else
                compilerContent += targetKey + `: ${PROJECT_NAME}_CC += -march=${platformName} ${platformFlags}\n`;

            // ***** include
            includePathsContent += targetKey + `: ${PROJECT_NAME}_INCLUDES += `
            let includesArray = ('includePaths' in project) ? project['includePaths'][platform][config] : [];
            includesArray.forEach(item =>
            {
                if (!path.isAbsolute(item))
                    item = FileHelper.relative(options.build.outputPath, item);
                includePathsContent += '-I' + item + ' ';
            });
            includePathsContent += '\n'

            // ***** defines
            definesContent += targetKey + `: ${PROJECT_NAME}_DEFINES += `
            let definesArray = ('defines' in project) ? project['defines'][platform][config] : [];
            definesArray.forEach(item =>
            {
                definesContent += '-D' + getDefineEntry(item) + ' ';
            });
            definesContent += '\n'

            // ***** libPaths
            libPathsContent += targetKey + `: ${PROJECT_NAME}_LIB_PATHS += `
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
            buildFlagsContent += targetKey + `: ${PROJECT_NAME}_CXXFLAGS += `
            let buildFlagsArray = ('buildFlags' in project) ? project['buildFlags'][platform][config] : [];
            buildFlagsArray.forEach(item =>
            {
                buildFlagsContent += item + ' ';
            });

            // append global config flags
            buildFlagsContent += '$(' + PROJECT_NAME + '_' + config.toUpperCase() + ')'
            buildFlagsContent += '\n'


            // ***** linkerFlags
            linkerFlagsContent += targetKey + `: ${PROJECT_NAME}_LDFLAGS += `

            let rpath = `-Wl,-rpath,"@executable_path"`;
            if (os.platform() == 'linux')
                rpath = '-Wl,-rpath,\'$$$$ORIGIN\'';
            else (os.platform() == 'win32')
                rpath = '';

            linkerFlagsContent += rpath;

            let linkerFlagsArray = ('linkerFlags' in project) ? project['linkerFlags'][platform][config] : [];
            linkerFlagsArray.forEach(item =>
            {
                linkerFlagsContent += item + ' ';
            });
            linkerFlagsContent += '\n'
        }
    }

    // apply
    await replace({files: projectFilePath, from: `#TARGET_COMPILER#`, to: compilerContent.trim()});
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

    files.map(file => FileHelper.resolve(file));

    for(let settingsKey in Globals.DEFAULT_BUILD_SETTINGS)
    {
        let val = Globals.DEFAULT_BUILD_SETTINGS[settingsKey];
        if ('settings' in project && settingsKey in project.settings)
            val = project.settings[settingsKey];

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

        for(let platformI in options.build.arch)
        {
            let platform = options.build.arch[platformI];

            for(let configI in Globals.CONFIGURATIONS)
            {
                let config = Globals.CONFIGURATIONS[configI];
                let targetKey = getTargetKey(projectName, options.build.arch, platformI, configI);
                let hookKey = targetKey + '_' + hookName;

                hookContent += hookKey + ':\n';

                if (Helper.hasKeys(project, 'hooks', hookName, platform, config))
                {
                    for(let i in project['hooks'][hookName][platform][config])
                    {
                        let hook = project['hooks'][hookName][platform][config][i];
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

    for(let platformI in options.build.arch)
    {
        let platform = options.build.arch[platformI];

        for(let configI in Globals.CONFIGURATIONS)
        {
            let config = Globals.CONFIGURATIONS[configI];
            let targetKey = getTargetKey(projectName, options.build.arch, platformI, configI);
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
                        let to = FileHelper.join(getBinDir(platform, config), path.basename(from));

                        copyContent += `	cp -f ${from} ${to}\n`;
                    }
                }
            });
        }
    }

    results = await replace({files: projectFilePath, from: '#COPY#', to: copyContent.trim()});
}


async function applyAssets(projectName, project, options)
{
    let assetsContent = projectName + '_assets:\n';

    if ('assets' in project && !options.build.skipAssets)
    {
        let copyScript = os.platform() == 'win32' ? 'copyAssets.cmd' : 'copyAssets.sh';
        let copyScriptOutPath = options.build.outputPath + '/' + copyScript;

        let scriptContent = '';
        if (os.platform() == 'win32')
        {
            scriptContent += 'rmdir "' + path.join(Globals.DEFAULT_ASSET_DIR) + ' /s /Q "\n';
            scriptContent += 'md "' + path.join(Globals.DEFAULT_ASSET_DIR) + '/"\n\n';
        }
        else
        {
            scriptContent += 'rm  -rf "' + FileHelper.join(Globals.DEFAULT_ASSET_DIR) + '/"\n';
            scriptContent += 'mkdir "' + FileHelper.join(Globals.DEFAULT_ASSET_DIR) + '/"\n\n';
        }

        // create asset dir
        await fs.mkdirSync(FileHelper.join(options.build.outputPath, Globals.DEFAULT_ASSET_DIR));

        // generate copy script
        for(let i in project.assets)
        {
            let asset = project.assets[i];

            let source = path.resolve(path.join(project.workingDir, asset.source));
            if (FileHelper.isDir(source) && os.platform() != 'win32')
                source += '/';

            let dest = path.join(Globals.DEFAULT_ASSET_DIR, asset.destination);

            let excludeRSync = '';
            let excludeXCopy = '';
            if ('exclude' in asset)
            {
                asset.exclude.forEach(excludeItem =>
                {
                    excludeRSync += `--exclude "${excludeItem}" `;
                    excludeXCopy += excludeItem.replace('*.', '.').replace('.*', '.')+'\r\n';
                });
            }

            const xCopyExcludeFile = projectName + '_' + i + '_excludes.txt';
            const cXopyExcludeFilePath = path.join(options.build.outputPath, xCopyExcludeFile);
            fs.writeFileSync(cXopyExcludeFilePath, excludeXCopy);

            const rsync = `rsync -av ${excludeRSync.trim()} "${source}" "${dest}"\n`;
            const cxopy = `call xcopy "${source}" "${dest}" /E /I /Y /exclude:${xCopyExcludeFile}\r\n`;

            if (os.platform() == 'win32')
                scriptContent += cxopy;
            else
                scriptContent += rsync;
        }

        fs.writeFileSync(copyScriptOutPath, scriptContent);
        fs.chmodSync(copyScriptOutPath, 0o744);

        if (os.platform() == 'win32')
            assetsContent += `	${copyScript}\n\n`;
        else
            assetsContent += `	sh ${copyScript}\n\n`;
    }

    let projectFilePath = options.build.outputPath + '/' + projectName + '.mk';
    await replace({files: projectFilePath, from: `#ASSETS#`, to: assetsContent.trim()});
}

module.exports = makeMakefile;
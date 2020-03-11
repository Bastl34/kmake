const path = require('path');
const fs = require('fs');

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
    'dynamic': '.so',
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
            item[name] = item[name].replace(/\"/g, '\\\"').replace(/\\\\/g, '\\');

        return '"' + name + '=\'' + item[name] + '\'"';
    }

    return '"' + item + '"';
}

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

        //console.log(objectList)

        /*
       soucesList.forEach(file =>
       {
           //get the relative path from output dir to source
           let absolutePath = path.resolve(file.path);
           let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + file.name;

           sourceFileContent += '		' + file.uid2 + ' / ' + file.name + ' in Sources / = {isa = PBXBuildFile; fileRef = ' + file.uid + ' / ' + file.name + ' /; };\n';
           sourceFileReferenceContent += '		' + file.uid + ' / ' + file.name + ' / = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = ' + file.type + '; name = ' + file.name + '; path = ' + relativePath + '; sourceTree = "<group>"; };\n';

           //only source files
           if (file.type.indexOf('sourcecode') != -1 && file.type.indexOf('.h') == -1)
               compileFiles += '				' + file.uid2 + ' / ' + file.name + ' in Sources /,\n';

           //only header files
           if (file.type.indexOf('.h') != -1)
               headerFiles += '				' + file.uid2 + ' / ' + file.name + ' in Sources /,\n';
       });
       */


       //platform specific targets

        let targets = ''
        for(let platformI in Globals.ARCHS[options.build.template])
        {
            let platform = Globals.ARCHS[options.build.template][platformI];

            for(let configI in Globals.CONFIGURATIONS)
            {
                let config = Globals.CONFIGURATIONS[configI];

                let targetKey = getTargetKey(projectName, options.build.template, platformI, configI);

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
                        libsContent += ' -l"' + lib + '.a"';
                    }
                    else
                        libsContent += ' -l"' + path.basename(lib) + '"';
                });

                //create all output dirs
                fs.mkdirSync(path.dirname(outPathAbsolute), { recursive: true });

                targets += targetKey + ': ' + objectList.join(' ') + '\n';

                if (outputType == 'static')
                    targets += `	$(AR) $(ARFLAGS) ${outPath} ${objectList.join(' ')}\n\n`;
                else
                    targets += `	$(CC) $(PRE_FLAGS) ${objectList.join(' ')} ${libsContent.trim()} -o ${outPath} $(POST_FLAGS)\n\n`;
            }
        }

        let defaultTarget = getTargetKey(projectName, options.build.template, 0, 0);

        // ********** replacements
        Logging.log('generating ' + projectName + '.mk');
        let projectFilePath = options.build.outputPath + '/' + projectName + '.mk';

        //results = await replace({files: projectFilePath, from: /PROJECT_ID/g, to: projectId});
        //results = await replace({files: workspaceContentPath, from: /PROJECT_ID/g, to: projectId});
        //results = await replace({files: schemePath, from: /PROJECT_ID/g, to: projectId});

        //results = await replace({files: projectFilePath, from: /PROJECT_NAME/g, to: projectName});
        //results = await replace({files: workspaceContentPath, from: /PROJECT_NAME/g, to: projectName});
        //results = await replace({files: schemePath, from: /PROJECT_NAME/g, to: projectName});

        results = await replace({files: projectFilePath, from: '#DEFAULT_TARGET#', to: defaultTarget});
        results = await replace({files: projectFilePath, from: '#TARGETS#', to: targets});
        results = await replace({files: projectFilePath, from: '#SOURCE_FILE#', to: sourceFileContent.trim()});
        //results = await replace({files: projectFilePath, from: '/COMPILE_FILES/', to: compileFiles.trim()});
        //results = await replace({files: projectFilePath, from: '/HEADER_FILES/', to: headerFiles.trim()});
        //results = await replace({files: projectFilePath, from: '/SOURCE_DIRECTORIES/', to: sourceDirectories.trim()});
        //results = await replace({files: projectFilePath, from: '/SOURCE_ROOT/', to: sourceRoot.trim()});
        //results = await replace({files: projectFilePath, from: '/LIBRARIES_LIST/', to: libList.trim()});
        //results = await replace({files: projectFilePath, from: '/LIBRARIES_BUILD/', to: libBuildList.trim()});
        //results = await replace({files: projectFilePath, from: '/EMBED_LIBRARIES/', to: libEmbedList.trim()});


        // ********** platform specific data
        Logging.log("applying platform data...");
        await applyPlatformData(projectName, project, options);

        // ********** apply settings
        Logging.log("applying project settings...");
        await applyProjectSettings(projectName, project, options);

        /*
        // ********** apply icon
        Logging.log("generating icons...");
        await applyIcon(projectName, project, options);

        // ********** assets
        Logging.log("applying asset data...");
        await applyAssets(projectName, project, options);

        // ********** replacements
        Logging.log("applying replacements...");
        applyReplacements(projectName, project, options);

        // ********** hooks
        Logging.log("applying hooks...");
        await applyHooks(projectName, projectId, project, options);
        */

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

            //append all dirs for libs
            let libsArray = ('dependencies' in project) ? project['dependencies'][platform][config] : [];
            libsArray.forEach(lib =>
            {
                if (!(lib in options))
                {
                    /* TODO
                    //check if there is a dll and copy the dll on post build
                    let dllPath = lib.replace('.lib', '.dll');
                    if (fs.existsSync(dllPath))
                    {
                        dllPathRelative = FileHelper.relative(path.join(options.build.outputPath, projectName), dllPath);
                        let dllName = path.basename(dllPath);
                        hookPostBuildContent += `        copy /Y "$(ProjectDir)\\${path.normalize(dllPathRelative)}" "$(SolutionDir)$(Platform)\\$(Configuration)\\${dllName}"\r\n`;
                    }
                    */

                    //change lib path relative to output dir
                    if (!path.isAbsolute(lib))
                        lib = FileHelper.relative(path.join(options.build.outputPath, projectName), lib);
                    lib = path.dirname(lib)
                    libPathsContent += ' -L"' + lib + '"';
                }
            });

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

module.exports = makeMakefile;
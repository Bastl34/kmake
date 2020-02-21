const path = require('path');
const fs = require('fs');

const copy = require('recursive-copy');
const replace = require('replace-in-file');

const Helper = require('../helper/helper');
const FileHelper = require('../helper/fileHelper');
const MakeHelper = require('../helper/makeHelper');
const Logging = require('../helper/logging');


const Globals = require('../globals');

const SOURCE_FILETYPE_MAP =
{
    '.cpp': 'source',
    '.c': 'source',

    '.hpp': 'header',
    '.h': 'header'
};

const OUTPUT_TYPE_MAP =
{
    'app': 'main',
    'framework': 'dynamic'
};

const DEPENDENCY_FILE_ENDING_BY_OUTPUT_TYPE =
{
    'static': '.lib',
    'dynamic': '.lib'
};

const SETTINGS_MAP =
{
    'VS_C_RUNTIME':
    {
        'release':
        {
            'MT': 'MultiThreaded',
            'MD': 'MultiThreadedDLL',
        },
        'debug':
        {
            'MT': 'MultiThreadedDebug',
            'MD': 'MultiThreadedDebugDLL',
        }
    }
};

function uuid()
{
    let a = Helper.randomString(8, '0123456789ABCDEF', false);
    let b = Helper.randomString(4, '0123456789ABCDEF', false);
    let c = Helper.randomString(4, '0123456789ABCDEF', false);
    let d = Helper.randomString(4, '0123456789ABCDEF', false);
    let e = Helper.randomString(12, '0123456789ABCDEF', false);

    return `${a}-${b}-${c}-${d}-${e}`;
}

function getDefineEntry(item)
{
    if (!item)
        return "";

    if (item instanceof Object)
    {
        let name = Object.keys(item)[0];
        //let isStr = typeof item[name] === 'string';
        //return name + "=" + (isStr ? '"' + item[name] + '"' : item[name]);
        return name + "=" + item[name];
    }

    return item;
}

async function makeVisualStudio(options)
{
    const vsVersion = 'vs2019';

    // ******************** copy projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        let outputType = project.outputType;
        if (outputType in OUTPUT_TYPE_MAP)
            outputType = OUTPUT_TYPE_MAP[outputType];

        let sourcePath = path.join(options.build.templatePath, outputType);
        let destPath = path.join(options.build.outputPath, projectName);

        await copy(sourcePath, destPath, {overwrite: true});

        //rename project files
        fs.renameSync(path.join(destPath,outputType+'.vcxproj'), path.join(destPath,projectName+'.vcxproj'));
        fs.renameSync(path.join(destPath,outputType+'.vcxproj.filters'), path.join(destPath,projectName+'.vcxproj.filters'));
        fs.renameSync(path.join(destPath,outputType+'.vcxproj.user'), path.join(destPath,projectName+'.vcxproj.user'));
    }

    // ******************** generate workspace.sln ********************
    Logging.log('generating ' + options.workspace.name + '.sln');
    let sourcePath = options.build.templatePath + '/workspace.sln';
    let destPath = options.build.outputPath + '/' + options.workspace.name + '.sln';

    await copy(sourcePath, destPath, {overwrite: true});

    let solutionId1 = uuid();
    let solutionId2 = uuid();

    let projectDef = '';
    let platformDef = '';

    //generate project ids
    let projectIds = {}

    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        let projectId = uuid();
        projectIds[projectName] = projectId;
    }

    //generate solution file
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let projectId = projectIds[projectName];

        //project definition with all dependencies
        projectDef += `Project("{${solutionId1}}") = "${projectName}", ".\\${projectName}\\${projectName}.vcxproj", "{${projectId}}"\n`;
        projectDef += `	ProjectSection(ProjectDependencies) = postProject\n`;

        if (projectName in options && 'dependencies' in options[projectName])
        {
            let project = options[projectName];

            //use win32 release
            let libs = [];
            if ('dependencies' in project && 'win32' in project.dependencies)
                libs = project.dependencies['win32']['release'];

            libs.forEach(lib =>
            {
                if (lib in options)
                    projectDef += `		{${projectIds[lib]}} = {${projectIds[lib]}}\n`;
            });
        }

        projectDef += `	EndProjectSection\n`;
        projectDef += `EndProject\n`;

        Globals.PLATFORMS[vsVersion].forEach(platform =>
        {
            Globals.CONFIGURATIONS.forEach(config =>
            {
                let configName = Helper.capitalizeFirstLetter(config);
                platformDef += `		{${projectId}}.${configName}|${platform}.ActiveCfg = ${configName}|${platform}\n`;
                platformDef += `		{${projectId}}.${configName}|${platform}.Build.0 = ${configName}|${platform}\n`;
            });
        });
    }

    results = await replace({files: destPath, from: '#PROJECT_DEF#', to: projectDef.trim()});
    results = await replace({files: destPath, from: '#PLATFORM_DEF#', to: platformDef.trim()});
    results = await replace({files: destPath, from: '#SOLUTION_ID#', to: solutionId2});


    // ******************** generate projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        let outputType = project.outputType;
        if (outputType in OUTPUT_TYPE_MAP)
            outputType = OUTPUT_TYPE_MAP[outputType];

        if (project.type != 'project' && project.projectType != 'source')
            continue;

        Logging.info('========== ' + projectName + ' ==========');


        // ********** beforePrepare hook

        //use win32 release
        if (Helper.hasKeys(project, 'hooks', 'beforePrepare', 'win32', 'release'))
        {
            for(let i in project.hooks.beforePrepare.win32.release)
            {
                let hook = project.hooks.beforePrepare.win32.release[i];
                await MakeHelper.runHook(hook, project.workingDir);
            }
        }

        let soucesList = [];
        let directoryList = {};

        // ********** files
        project.sources.forEach(file =>
        {
            let type = 'unknown';
            let ext = path.extname(file);
            if (ext in SOURCE_FILETYPE_MAP)
                type = SOURCE_FILETYPE_MAP[ext];

            //dirs
            let directory = path.dirname(file);

            //get relative paths
            if (project.workingDir && project.workingDir.length > 0)
                directory = directory.substr(project.workingDir.length + 1);

            let filePathRelative = file;
            if (project.workingDir && project.workingDir.length > 0)
                filePathRelative = filePathRelative.substr(project.workingDir.length + 1);

            if (directory)
            {
                directoryList[directory] = true;

                //add all subdir's
                let subDirs = FileHelper.getAllParentDirectoryPaths(directory);
                subDirs.forEach(subDir => { directoryList[subDir] = true; });
            }

            //file
            let sourceObj =
            {
                name: path.basename(file),
                path: file,
                pathRelative: filePathRelative,
                dir: directory,
                uid: uuid(),
                uid2: Helper.randomString(8, '0123456789ABCDEF', false),
                type: type
            };

            soucesList.push(sourceObj);
        });

        //make array out of directory list
        directoryList = Object.keys(directoryList);
        let directoryObjectList = [];

        // ********** directories
        directoryList.forEach(dir =>
        {
            //file
            let sourceObj =
            {
                name: path.basename(dir),
                uid: uuid(),
                path: dir
            };

            directoryObjectList.push(sourceObj);
        });

        directoryList = directoryObjectList;

        //sort
        soucesList.sort((a, b) =>
        {
            if (a.path.length < b.path.length) return -1;
            if (b.path.length < a.path.length) return 1;
            return 0;
        });

        directoryList.sort((a, b) =>
        {
            if (a.path.length < b.path.length) return -1;
            if (b.path.length < a.path.length) return 1;
            return 0;
        });


        // ********** create visual studio project file strings
        let compileFiles = '';
        let headerFiles = '';
        let assetFiles = '';

        let compileFilesFilters = '';
        let headerFilesFilters = '';
        let assetFilesFilters = '';

        soucesList.forEach(file =>
        {
            //get the relative path from output dir to source
            let absolutePath = path.resolve(file.path);
            let relativePath = path.relative(path.join(options.build.outputPath, outputType) , path.dirname(absolutePath)) + '/' + file.name;

            let outFileName = file.name + '.' + file.uid2 + '.obj';

            if (file.type == 'source')
            {
                compileFiles += '    <ClCompile Include="' + relativePath + '" >\r\n';
                compileFiles += '    	<ObjectFileName>$(IntDir)/' + outFileName + '</ObjectFileName>\r\n';
                compileFiles += '    </ClCompile>\r\n';

                compileFilesFilters += '    <ClCompile Include="' + relativePath + '">\r\n';
                compileFilesFilters += '      <Filter>' + path.normalize(file.dir)+'</Filter>\r\n';
                compileFilesFilters += '    </ClCompile>\r\n';
            }
            else if (file.type == 'header')
            {
                headerFiles += '    <ClInclude Include="' + relativePath + '" />\r\n';

                headerFilesFilters += '    <ClInclude Include="' + relativePath + '">\r\n';
                headerFilesFilters += '      <Filter>' + path.normalize(file.dir)+'</Filter>\r\n';
                headerFilesFilters += '    </ClInclude>\r\n';
            }
            else
            {
                assetFiles += '    <None Include="' + relativePath + '" />\r\n';

                assetFilesFilters += '    <None Include="' + relativePath + '">\r\n';
                assetFilesFilters += '      <Filter>' + path.normalize(file.dir)+'</Filter>\r\n';
                assetFilesFilters += '    </None>\r\n';
            }
        });

        // ********** source groups folders
        let directoriesFilters = '';
        directoryList.forEach(directory =>
        {
            directoriesFilters += '    <Filter Include="' + path.normalize(directory.path) + '">\r\n';
            directoriesFilters += '      <UniqueIdentifier>{' + directory.uid + '}</UniqueIdentifier>\r\n';
            directoriesFilters += '    </Filter>\r\n';
        });

        // ********** replacements
        let projectFilePath = options.build.outputPath + '/' + projectName + '/' + projectName + '.vcxproj';
        let projectFilePathFilters = projectFilePath + '.filters';

        results = await replace({files: projectFilePath, from: /#PROJECT_ID#/g, to: projectIds[projectName]});
        results = await replace({files: projectFilePath, from: /#PROJECT_NAME#/g, to: projectName});

        results = await replace({files: projectFilePath, from: '<!--[COMPILE_FILES]-->', to: compileFiles.trim()});
        results = await replace({files: projectFilePath, from: '<!--[INCLUDE_FILES]-->', to: headerFiles.trim()});
        results = await replace({files: projectFilePath, from: '<!--[ASSET_FILES]-->', to: assetFiles.trim()});

        results = await replace({files: projectFilePathFilters, from: '<!--[DIRECTORIES]-->', to: directoriesFilters.trim()});
        results = await replace({files: projectFilePathFilters, from: '<!--[COMPILE_FILES]-->', to: compileFilesFilters.trim()});
        results = await replace({files: projectFilePathFilters, from: '<!--[INCLUDE_FILES]-->', to: headerFilesFilters.trim()});
        results = await replace({files: projectFilePathFilters, from: '<!--[ASSET_FILES]-->', to: assetFilesFilters.trim()});

        // ********** platform specific data
        Logging.log("applying platform data...");
        await applyPlatformData(projectName, project, options);

        // ********** assets
        Logging.log("applying asset data...");
        await applyAssets(projectName, project, options);

        // ********** afterPrepare hook

        //use win32 release
        if (Helper.hasKeys(project, 'hooks', 'afterPrepare', 'win32', 'release'))
        {
            for(let i in project.hooks.afterPrepare.win32.release)
            {
                let hook = project.hooks.afterPrepare.win32.release[i];
                await MakeHelper.runHook(hook, project.workingDir);
            }
        }
    }
    return true;
}

async function applyPlatformData(projectName, project, options)
{
    let projectFilePath = options.build.outputPath + '/' + projectName + '/' + projectName + '.vcxproj';
    let projectUserPath = projectFilePath + '.user';

    for(let platformI in Globals.PLATFORMS[options.build.template])
    {
        let platform = Globals.PLATFORMS[options.build.template][platformI];

        //Globals.CONFIGURATIONS.forEach(config =>
        for(let configI in Globals.CONFIGURATIONS)
        {
            let config = Globals.CONFIGURATIONS[configI];
            let configKey = config.toUpperCase();

            //hook: pre build
            let hookPreBuildContent = '';
            let hookPreBuildArray = ('hooks' in project && 'preBuild' in project.hooks) ? project['hooks']['preBuild'][platform][config] : [];
            hookPreBuildArray.forEach(item =>
            {
                hookPreBuildContent += '        ' + item + '\r\n';
            });

            //hook: post build
            let hookPostBuildContent = '';
            let hookPostBuildArray = ('hooks' in project && 'postBuild' in project.hooks) ? project['hooks']['postBuild'][platform][config] : [];
            hookPostBuildArray.forEach(item =>
            {
                hookPostBuildContent += '        ' + item + '\r\n';
            });

            //hook: pre link
            let hookPreLinkContent = '';
            let hookPreLinkArray = ('hooks' in project && 'preLink' in project.hooks) ? project['hooks']['preLink'][platform][config] : [];
            hookPreLinkArray.forEach(item =>
            {
                hookPreLinkContent += '        ' + item + '\r\n';
            });

            //include
            let includePathsContent = '';
            let includesArray = ('includePaths' in project) ? project['includePaths'][platform][config] : [];
            includesArray.forEach(item =>
            {
                if (!path.isAbsolute(item))
                    item = FileHelper.relative(path.join(options.build.outputPath, projectName), item);
                includePathsContent += '"' + item + '";';
            });

            //defines
            let definesContent = '';
            let definesArray = ('defines' in project) ? project['defines'][platform][config] : [];
            definesArray.forEach(item =>
            {
                definesContent += getDefineEntry(item) + ';';
            });

            //libPaths
            let libPathsContent = '';
            let libsPathsArray = ('libPaths' in project) ? project['libPaths'][platform][config] : [];
            libsPathsArray.forEach(item =>
            {
                if (!path.isAbsolute(item))
                    item = FileHelper.relative(path.join(options.build.outputPath, projectName), item);
                libPathsContent += item + ';';
            });

            //dependencies
            let libsContent = '';
            let libsArray = ('dependencies' in project) ? project['dependencies'][platform][config] : [];
            libsArray.forEach(lib =>
            {
                if (lib in options)
                {
                    let outputType = options[lib].outputType;
                    if (!(outputType in DEPENDENCY_FILE_ENDING_BY_OUTPUT_TYPE))
                    {
                        Logging.error('outputType: ' + outputType +  ' not supported for ' + lib);
                        return false;
                    }

                    lib += DEPENDENCY_FILE_ENDING_BY_OUTPUT_TYPE[outputType];
                }
                else
                {
                    //check if there is a dll and copy the dll on post build
                    let dllPath = lib.replace('.lib', '.dll');
                    if (fs.existsSync(dllPath))
                    {
                        dllPathRelative = FileHelper.relative(path.join(options.build.outputPath, projectName), dllPath);
                        let dllName = path.basename(dllPath);
                        hookPostBuildContent += `        copy /Y "$(ProjectDir)\\${path.normalize(dllPathRelative)}" "$(SolutionDir)$(Platform)\\$(Configuration)\\${dllName}"\r\n`;
                    }

                    //change lib path relative to output dir
                    if (!path.isAbsolute(lib))
                        lib = FileHelper.relative(path.join(options.build.outputPath, projectName), lib);
                }

                libsContent += '"' + lib + '";';
            });

            //buildFlags
            let buildFlagsContent = '';
            let buildFlagsArray = ('buildFlags' in project) ? project['buildFlags'][platform][config] : [];
            buildFlagsArray.forEach(item =>
            {
                buildFlagsContent += item + ' ';
            });

            //linkerFlags
            let linkerFlagsContent = '';
            let linkerFlagsArray = ('linkerFlags' in project) ? project['linkerFlags'][platform][config] : [];
            linkerFlagsArray.forEach(item =>
            {
                linkerFlagsContent += item + ' ';
            });

            let configName = Helper.capitalizeFirstLetter(config);

            //apply
            await replace({files: projectFilePath, from: new RegExp(`<!--INCLUDES_${platform}_${configName}-->`, 'g'), to: includePathsContent.trim()});
            await replace({files: projectFilePath, from: new RegExp(`<!--DEFINES_${platform}_${configName}-->`, 'g'), to: definesContent.trim()});
            await replace({files: projectFilePath, from: new RegExp(`<!--LIB_PATHS_${platform}_${configName}-->`, 'g'), to: libPathsContent.trim()});
            await replace({files: projectFilePath, from: new RegExp(`<!--LIBS_${platform}_${configName}-->`, 'g'), to: libsContent.trim()});

            await replace({files: projectFilePath, from: new RegExp(`<!--BUILD_FLAGS_${platform}_${configName}-->`, 'g'), to: buildFlagsContent.trim()});
            await replace({files: projectFilePath, from: new RegExp(`<!--LINKER_FLAGS_${platform}_${configName}-->`, 'g'), to: linkerFlagsContent.trim()});

            await replace({files: projectUserPath, from: new RegExp(`<!--LIB_PATHS_${platform}_${configName}-->`, 'g'), to: libPathsContent.trim()});

            await replace({files: projectFilePath, from: new RegExp(`<!--HOOK_PRE_BUILD_${platform}_${configName}-->`, 'g'), to: hookPreBuildContent.trim()});
            await replace({files: projectFilePath, from: new RegExp(`<!--HOOK_POST_BUILD_${platform}_${configName}-->`, 'g'), to: hookPostBuildContent.trim()});
            await replace({files: projectFilePath, from: new RegExp(`<!--HOOK_PRE_LINK_${platform}_${configName}-->`, 'g'), to: hookPreLinkContent.trim()});

            // ********** apply settings
            Logging.log(`applying project settings for ${platform} ${configName}...`);
            await applyProjectSettings(projectName, project, options);
        }
    }
}

async function applyProjectSettings(projectName, project, options)
{
    let files = [];

    files.push(options.build.outputPath + '/' + projectName + '/' + projectName + '.vcxproj');
    files.push(options.build.outputPath + '/' + projectName + '/' + projectName + '.vcxproj.user');

    files.map(file => path.resolve(file));

    for(let settingsKey in Globals.DEFAULT_BUILD_SETTINGS)
    {
        let val = Globals.DEFAULT_BUILD_SETTINGS[settingsKey];
        if ('settings' in project && settingsKey in project.settings)
            val = project.settings[settingsKey];

        for(let platformI in Globals.PLATFORMS[options.build.template])
        {
            let platform = Globals.PLATFORMS[options.build.template][platformI];

            //Globals.CONFIGURATIONS.forEach(config =>
            for(let configI in Globals.CONFIGURATIONS)
            {
                let config = Globals.CONFIGURATIONS[configI];
                let configKey = config.toUpperCase();
                let configName = Helper.capitalizeFirstLetter(config);

                //resolve value
                let resolvedVal = null;
                if (settingsKey in SETTINGS_MAP)
                {
                    //direct
                    if (val in SETTINGS_MAP[settingsKey] && typeof SETTINGS_MAP[settingsKey][val] == 'string')
                        resolvedVal = SETTINGS_MAP[settingsKey][val];

                    //based on config
                    if (config in SETTINGS_MAP[settingsKey] && val in SETTINGS_MAP[settingsKey][config] && typeof SETTINGS_MAP[settingsKey][config][val] == 'string')
                        resolvedVal = SETTINGS_MAP[settingsKey][config][val];

                    //based on platform
                    if (platform in SETTINGS_MAP[settingsKey] && val in SETTINGS_MAP[settingsKey][platform] && typeof SETTINGS_MAP[settingsKey][platform][val] == 'string')
                        resolvedVal = SETTINGS_MAP[settingsKey][platform][val];

                    //based on platform and config
                    if (platform in SETTINGS_MAP[settingsKey] && config in SETTINGS_MAP[settingsKey][platform] && val in  SETTINGS_MAP[settingsKey][platform][config])
                        resolvedVal = SETTINGS_MAP[settingsKey][platform][config][val];
                }

                if (!resolvedVal)
                    resolvedVal = val;

                await replace({files: files, from: new RegExp(`<!--${settingsKey}-->`, 'g'), to: resolvedVal.trim()});
                await replace({files: files, from: new RegExp(`<!--${settingsKey}_${platform}_${configName}-->`, 'g'), to: resolvedVal.trim()});
                await replace({files: files, from: new RegExp(`<!--${settingsKey}_${platform}-->`, 'g'), to: resolvedVal.trim()});
                await replace({files: files, from: new RegExp(`<!--${settingsKey}_${configName}-->`, 'g'), to: resolvedVal.trim()});
            }
        }
    }

    return true;
}

async function applyAssets(projectName, project, options)
{
    if (!('assets' in project))
        return;

    if (!(fs.existsSync(options.build.outputPath + '/' + projectName)))
    {
        Logging.warning('there is no content directory (assets) for this type of project: '+project.outputType);
        return;
    }

    let copyScript = projectName + '/copyAssets.cmd';
    let copyScriptOutPath = options.build.outputPath + '/' + copyScript;

    let scriptContent = '';

    //create asset dir
    await fs.mkdirSync(path.join(options.build.outputPath, Globals.DEFAULT_ASSET_DIR));

    //generate copy script
    for(let i in project.assets)
    {
        let excludeFile = 'copyAssetsExclude_' + i + '.txt';
        let asset = project.assets[i];

        let source = path.normalize(path.resolve(path.join(project.workingDir, asset.source)));
        let dest = path.normalize(path.resolve(path.join(options.build.outputPath, Globals.DEFAULT_ASSET_DIR, asset.destination)) + '/');

        let assetDir = path.normalize(path.resolve(path.join(options.build.outputPath, Globals.DEFAULT_ASSET_DIR, asset.destination)));

        scriptContent += 'if exist "' + assetDir + '" rmdir "' + assetDir + '\\" /s /Q\n';
        scriptContent += 'md "' + assetDir + '/"\r\n';

        let exclude = '';
        if ('exclude' in asset)
        {
            asset.exclude.forEach(excludeItem =>
            {
                excludeItem = excludeItem.replace("*.", ".").replace(".*", ".");

                exclude += `${excludeItem}\r\n`;
            });
        }

        fs.writeFileSync(options.build.outputPath + '/' + projectName + '/' + excludeFile, exclude);

        let xcopy = `xcopy "${source}" "${dest}" /E /I /Y /exclude:${excludeFile}\r\n`;
        scriptContent += xcopy +'\r\n';
    }

    fs.writeFileSync(copyScriptOutPath, scriptContent);
    //fs.chmodSync(copyScriptOutPath, 0o744);

    let cmd = 'cmd.exe /c "copyAssets.cmd"'

    let projectFilePath = options.build.outputPath + '/' + projectName + '/' + projectName + '.vcxproj';
    await replace({files: projectFilePath, from: new RegExp(`<!--COPY_ASSETS-->`, 'g'), to: cmd});
}

module.exports = makeVisualStudio;
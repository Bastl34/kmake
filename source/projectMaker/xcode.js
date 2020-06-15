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
const ImageHelper = require('../helper/imageHelper');

const Globals = require('../globals');

const XCODE_SOURCE_FILETYPE_MAP =
{
    '.cpp': 'sourcecode.cpp.cpp',
    '.hpp': 'sourcecode.cpp.hpp',
    '.h': 'sourcecode.c.h',
    '.c': 'sourcecode.c.c',
    '.mm': 'sourcecode.cpp.objcpp',
    '.m': 'sourcecode.c.objc',

    '.swift': 'sourcecode.swift',

    'unknown': 'text'
};

const XCODE_BIN_FILETYPE_MAP =
{
    '.a': 'archive.ar',
    '.dylib': 'compiled.mach-o.dylib',
    '.framework': 'wrapper.framework',

    'unknown': 'text'
};

const FILE_ENDING_BY_OUTPUT_TYPE =
{
    'static': '.a',
    'dynamic': '.dylib',
    'framework': '.framework',

    'unknown': 'text'
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

async function makeXcode(options)
{
    let platform0 = options.build.arch[0];
    let config0 = Globals.CONFIGURATIONS[0];

    // ******************** copy projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        let sourcePath = options.build.templatePath + '/' + project.outputType + '.xcodeproj';
        let destPath = options.build.outputPath + '/' + projectName + '.xcodeproj';

        await copy(sourcePath, destPath, {overwrite: true});

        // renaming
        let from = path.join(destPath, 'xcshareddata/xcschemes', project.outputType + '.xcscheme');
        let to = path.join(destPath, 'xcshareddata/xcschemes', projectName + '.xcscheme');
        fs.renameSync(from, to);

        // check and copy extra dependencies
        if (fs.existsSync(options.build.templatePath + '/' + project.outputType))
        {
            sourcePath = options.build.templatePath + '/' + project.outputType;
            destPath = options.build.outputPath + '/' + projectName;

            await copy(sourcePath, destPath, {overwrite: true});
        }
    }


    // ******************** generate .xcworkspace ********************
    Logging.log('generating ' + options.workspace.name + '.xcworkspace');
    let sourcePath = options.build.templatePath + '/workspace.xcworkspace';
    let destPath = options.build.outputPath + '/' + options.workspace.name + '.xcworkspace';

    await copy(sourcePath, destPath, {overwrite: true});

    let fileRefStr = '';
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        fileRefStr += '   <FileRef location = "group:' + projectName + '.xcodeproj"></FileRef>\n';
    }

    let workspaceContentFilePath = destPath + '/contents.xcworkspacedata';

    await replace({files: workspaceContentFilePath, from: '<!--FileRef-->', to: fileRefStr.trim()});


    // ******************** generate projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        let projectId = Helper.randomString(24, '0123456789ABCDEF', false);


        Logging.info('========== ' + projectName + ' ==========');

        // ********** beforePrepare hook

        // use first platform/config release
        if (Helper.hasKeys(project, 'hooks', 'beforePrepare', platform0, config0))
        {
            for(let i in project.hooks.beforePrepare[platform0][config0])
            {
                let hook = project.hooks.beforePrepare[platform0][config0][i];
                await MakeHelper.runHook(hook, project.workingDir);
            }
        }

        let libsList = [];
        let embedsList = [];
        let soucesList = [];
        let directoryList = {};

        // ********** libs

        // use first platform/config release
        let libs = [];
        if ('dependencies' in project && platform0 in project.dependencies)
            libs = project.dependencies[platform0][config0];

        for(let libKey in libs)
        {
            let lib = libs[libKey];

            let isWorkspaceLib = (options.workspace.content.indexOf(lib) != -1 && 'workingDir' in options[lib]);

            // output name/filename by outputType
            if (isWorkspaceLib)
            {
                if (!('outputType' in options[lib]))
                {
                    Logging.error('no outputType found for ' + lib);
                    return false;
                }

                let outputType = options[lib].outputType;
                if (!(outputType in FILE_ENDING_BY_OUTPUT_TYPE))
                {
                    Logging.error('outputType: ' + outputType +  ' not supported for ' + lib);
                    return false;
                }

                lib += FILE_ENDING_BY_OUTPUT_TYPE[outputType];
            }

            let type = 'unknown';
            let ext = path.extname(lib);
            if (ext in XCODE_BIN_FILETYPE_MAP)
                type = XCODE_BIN_FILETYPE_MAP[ext];

            let libPathRelative = lib;
            if (project.workingDir && project.workingDir.length > 0)
                libPathRelative = libPathRelative.substr(project.workingDir.length + 1);

            // lib
            let libsObj =
            {
                name: path.basename(lib),
                isWorkspaceLib: isWorkspaceLib,
                path: lib,
                pathRelative: libPathRelative ? libPathRelative : null,
                uidRef: Helper.randomString(24, '0123456789ABCDEF', false),
                uidFile: Helper.randomString(24, '0123456789ABCDEF', false),
                uidEmbedRef: Helper.randomString(24, '0123456789ABCDEF', false),
                uidEmbed: Helper.randomString(24, '0123456789ABCDEF', false),
                type: type
            };

            libsList.push(libsObj);
        }

        // ********** embed

        // use first platform/config release
        let embeds = [];
        if ('embedDependencies' in project && platform0 in project.embedDependencies)
            embeds = project.embedDependencies[platform0][config0];

        for(let embedKey in embeds)
        {
            let embed = embeds[embedKey];

            let type = 'unknown';
            let ext = path.extname(embed);
            if (ext in XCODE_BIN_FILETYPE_MAP)
                type = XCODE_BIN_FILETYPE_MAP[ext];

            let embedPathRelative = embed;
            if (project.workingDir && project.workingDir.length > 0)
                embedPathRelative = embedPathRelative.substr(project.workingDir.length + 1);

            // embed
            let embedsObj =
            {
                name: path.basename(embed),
                path: embed,
                pathRelative: embedPathRelative ? embedPathRelative : null,
                uidRef: Helper.randomString(24, '0123456789ABCDEF', false),
                uidEmbed: Helper.randomString(24, '0123456789ABCDEF', false),
                type: type
            };

            embedsList.push(embedsObj);
        }

        // ********** files/sources
        // use first platform/config release
        let sources = [];
        if ('sources' in project && platform0 in project.sources)
            sources = project.sources[platform0][config0];

        sources.forEach(file =>
        {
            let type = 'unknown';
            let ext = path.extname(file);
            if (ext in XCODE_SOURCE_FILETYPE_MAP)
                type = XCODE_SOURCE_FILETYPE_MAP[ext];

            // dirs
            let directory = path.dirname(file);

            // get relative paths
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

            // file
            let sourceObj =
            {
                name: path.basename(file),
                path: file,
                pathRelative: filePathRelative,
                dir: directory,
                uidRef: Helper.randomString(24, '0123456789ABCDEF', false),
                uidFile: Helper.randomString(24, '0123456789ABCDEF', false),
                type: type
            };

            soucesList.push(sourceObj);
        });

        // make array out of directory list
        directoryList = Object.keys(directoryList);
        let directoryObjectList = [];

        // ********** directories
        directoryList.forEach(dir =>
        {
            // file
            let sourceObj =
            {
                name: path.basename(dir),
                path: dir,
                uidRef: Helper.randomString(24, '0123456789ABCDEF', false)
            };

            directoryObjectList.push(sourceObj);
        });

        directoryList = directoryObjectList;

        // sort
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

        // ********** create xcode project file strings
        let sourceFileContent = '';
        let sourceFileReferenceContent = '';
        let compileFiles = '';
        let headerFiles = '';
        let libList = '';
        let embedList = '';
        let libBuildList = '';
        let libEmbedList = '';

        soucesList.forEach(file =>
        {
            // get the relative path from output dir to source
            let absolutePath = path.resolve(file.path);
            let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + file.name;

            sourceFileContent += '		' + file.uidFile + ' /* ' + file.name + ' in Sources */ = {isa = PBXBuildFile; fileRef = ' + file.uidRef + ' /* ' + file.name + ' */; };\n';
            sourceFileReferenceContent += '		' + file.uidRef + ' /* ' + file.name + ' */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = ' + file.type + '; name = ' + file.name + '; path = ' + relativePath + '; sourceTree = "<group>"; };\n';

            // only source files
            if (file.type.indexOf('sourcecode') != -1 && file.type.indexOf('.h') == -1)
                compileFiles += '				' + file.uidFile + ' /* ' + file.name + ' in Sources */,\n';

            // only header files
            if (file.type.indexOf('.h') != -1)
                headerFiles += '				' + file.uidFile + ' /* ' + file.name + ' in Sources */,\n';
        });

        // ********** libs
        libsList.forEach(lib =>
        {
            // get the relative path from output dir to source
            let absolutePath = path.resolve(lib.path);

            let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + lib.name;
            if (lib.isWorkspaceLib || !fs.existsSync(absolutePath))
                relativePath = lib.name;

            sourceFileContent += '		' + lib.uidFile + ' /* ' + lib.name + ' in Frameworks */ = {isa = PBXBuildFile; fileRef = ' + lib.uidRef + ' /* ' + lib.name + ' */; };\n';

            // add to embed
            const embeddable = (lib.isWorkspaceLib && (lib.name.indexOf('.dylib') != -1 || lib.name.indexOf('.framework') != -1));
            if (embeddable)
                sourceFileContent += '		' + lib.uidEmbed + ' /* ' + lib.name + ' in Embed Libraries */ = {isa = PBXBuildFile; fileRef = ' + lib.uidEmbedRef + ' /* ' + lib.name + ' */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };\n';

            let fileTypeStr = '';
            if (lib.name.indexOf('framework') != -1)
                fileTypeStr = 'lastKnownFileType = ' + lib.type;
            else
                fileTypeStr = 'explicitFileType = ' + lib.type;

            let sourceTree = '';
            if (lib.isWorkspaceLib)
                sourceTree = 'BUILT_PRODUCTS_DIR';
            else
                sourceTree = '"<group>"';

            sourceFileReferenceContent += '		' + lib.uidRef + ' /* ' + lib.name + ' */ = {isa = PBXFileReference; ' + fileTypeStr + '; name = ' + lib.name + '; path = ' + relativePath + '; sourceTree = ' + sourceTree + '; };\n';

            if (embeddable)
                sourceFileReferenceContent += '		' + lib.uidEmbedRef + ' /* ' + lib.name + ' */ = {isa = PBXFileReference; ' + fileTypeStr + '; name = ' + lib.name + '; path = ' + relativePath + '; sourceTree = ' + sourceTree + '; };\n';

            // add to "framework" group
            libList += '				' + lib.uidRef + ' /* ' + lib.name + ' in Frameworks */,\n';

            // add to "embed" group
            if (embeddable)
                embedList += '				' + lib.uidEmbedRef + ' /* ' + lib.name + ' in Embeds */,\n';

            // add to build step
            libBuildList += '				' + lib.uidFile + ' /* ' + lib.name + ' in Frameworks */,\n';

            // add to embed
            if (embeddable)
                libEmbedList += '				' + lib.uidEmbed + ' /* ' + lib.name + ' in Embed Libraries */,\n';
        });

        // ********** emeds
        embedsList.forEach(embed =>
        {
            // get the relative path from output dir to source
            let absolutePath = path.resolve(embed.path);
            let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + embed.name;

            // add to embed
            sourceFileContent += '		' + embed.uidEmbed + ' /* ' + embed.name + ' in Embed Libraries */ = {isa = PBXBuildFile; fileRef = ' + embed.uidRef + ' /* ' + embed.name + ' */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };\n';

            let fileTypeStr = '';
            if (embed.name.indexOf('framework') != -1)
                fileTypeStr = 'lastKnownFileType = ' + embed.type;
            else
                fileTypeStr = 'explicitFileType = ' + embed.type;

            let sourceTree = '"<group>"';
            sourceFileReferenceContent += '		' + embed.uidRef + ' /* ' + embed.name + ' */ = {isa = PBXFileReference; ' + fileTypeStr + '; name = ' + embed.name + '; path = ' + relativePath + '; sourceTree = ' + sourceTree + '; };\n';

            // add to "embed" group
            embedList += '				' + embed.uidRef + ' /* ' + embed.name + ' in Embeds */,\n';

            // add to embed
            libEmbedList += '				' + embed.uidEmbed + ' /* ' + embed.name + ' in Embed Libraries */,\n';
        });

        // ********** source groups folders
        let sourceDirectories = '';
        directoryList.forEach(directory =>
        {
            // get containing dirs
            let containingDirs = [];
            directoryList.forEach(innerDir =>
            {
                if (FileHelper.isSubdirectory(directory.path, innerDir.path))
                    containingDirs.push(innerDir);
            });

            // get containing files
            let containingFiles = [];
            soucesList.forEach(innerFile =>
            {
                if (FileHelper.isSubdirectory(directory.path, innerFile.pathRelative))
                    containingFiles.push(innerFile);
            });

            // add to SOURCE_DIRECTORIES
            sourceDirectories += '		' + directory.uidRef + ' /* ' + directory.name + ' */ = {\n';
            sourceDirectories += '			isa = PBXGroup;\n';
            sourceDirectories += '			children = (\n';

            containingDirs.forEach(cDir =>
            {
                sourceDirectories += '				' + cDir.uidRef + ' /* ' + cDir.name + ' */,\n';
            });

            containingFiles.forEach(cFile =>
            {
                sourceDirectories += '				' + cFile.uidRef + ' /* ' + cFile.name + ' */,\n';
            });

            sourceDirectories += '			);\n';
            sourceDirectories += '			name = ' + directory.name + ';\n';
            sourceDirectories += '			sourceTree = "<group>";\n';
            sourceDirectories += '		};\n';
        });

        // ********** root source files/directories
        let sourceRoot = '';
        directoryList.forEach(directory =>
        {
            if (FileHelper.countDirectoryLevels(directory.path) == 1)
                sourceRoot += '				' + directory.uidRef + ' /* ' + directory.name + ' */,\n';
        });
        soucesList.forEach(file =>
        {
            if (FileHelper.countDirectoryLevels(file.pathRelative) == 1)
                sourceRoot += '				' + file.uidRef + ' /* ' + file.name + ' */,\n';
        });

        // ********** replacements
        Logging.log('generating ' + projectName + '.xcodeproj');
        let projectFilePath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj';
        let workspaceContentPath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.xcworkspace/contents.xcworkspacedata';
        let schemePath = options.build.outputPath + '/' + projectName + '.xcodeproj/xcshareddata/xcschemes/' + projectName + '.xcscheme';

        results = await replace({files: projectFilePath, from: /PROJECT_ID/g, to: projectId});
        results = await replace({files: workspaceContentPath, from: /PROJECT_ID/g, to: projectId});
        results = await replace({files: schemePath, from: /PROJECT_ID/g, to: projectId});

        results = await replace({files: projectFilePath, from: /PROJECT_NAME/g, to: projectName});
        results = await replace({files: workspaceContentPath, from: /PROJECT_NAME/g, to: projectName});
        results = await replace({files: schemePath, from: /PROJECT_NAME/g, to: projectName});

        results = await replace({files: projectFilePath, from: '/*SOURCE_FILE_REFERENCE*/', to: sourceFileReferenceContent.trim()});
        results = await replace({files: projectFilePath, from: '/*SOURCE_FILE*/', to: sourceFileContent.trim()});
        results = await replace({files: projectFilePath, from: '/*COMPILE_FILES*/', to: compileFiles.trim()});
        results = await replace({files: projectFilePath, from: '/*HEADER_FILES*/', to: headerFiles.trim()});
        results = await replace({files: projectFilePath, from: '/*SOURCE_DIRECTORIES*/', to: sourceDirectories.trim()});
        results = await replace({files: projectFilePath, from: '/*SOURCE_ROOT*/', to: sourceRoot.trim()});
        results = await replace({files: projectFilePath, from: '/*LIBRARIES_LIST*/', to: libList.trim()});
        results = await replace({files: projectFilePath, from: '/*EMBEDS_LIST*/', to: embedList.trim()});
        results = await replace({files: projectFilePath, from: '/*LIBRARIES_BUILD*/', to: libBuildList.trim()});
        results = await replace({files: projectFilePath, from: '/*EMBED_LIBRARIES*/', to: libEmbedList.trim()});

        // ********** platform specific data
        Logging.log("applying platform data...");
        await applyPlatformData(projectName, project, options);

        // ********** apply settings
        Logging.log("applying project settings...");
        await applyProjectSettings(projectName, project, options);

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

        // ********** afterPrepare hook

        // use first platform/config release
        if (Helper.hasKeys(project, 'hooks', 'afterPrepare', platform0, config0))
        {
            for(let i in project.hooks.afterPrepare[platform0][config0])
            {
                let hook = project.hooks.afterPrepare[platform0][config0][i];
                await MakeHelper.runHook(hook, project.workingDir);
            }
        }
    }

    return true;
}

async function applyPlatformData(projectName, project, options)
{
    let projectFilePath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj';

    for(let platformI in Globals.ARCHS[options.build.template])
    {
        let platform = Globals.ARCHS[options.build.template][platformI];

        for(let configI in Globals.CONFIGURATIONS)
        {
            let config = Globals.CONFIGURATIONS[configI];
            let configKey = config.toUpperCase();

            // include
            let includePathsContent = '';
            let includesArray = ('includePaths' in project) ? project['includePaths'][platform][config] : [];
            includesArray.forEach(item =>
            {
                if (!path.isAbsolute(item))
                    item = FileHelper.relative(options.build.outputPath, item);
                includePathsContent += '					"' + item + '",\n';
            });

            // defines
            let definesContent = '';
            let definesArray = ('defines' in project) ? project['defines'][platform][config] : [];
            definesArray.forEach(item =>
            {
                definesContent += '					' + getDefineEntry(item) + ',\n';
            });

            // libPaths
            let libPathsContent = '';
            let libsPathsArray = ('libPaths' in project) ? project['libPaths'][platform][config] : [];
            libsPathsArray.forEach(item =>
            {
                if (!path.isAbsolute(item))
                    item = FileHelper.relative(options.build.outputPath, item);
                libPathsContent += '					"' + item + '",\n';
            });

            // buildFlags
            let buildFlagsContent = '';
            let buildFlagsArray = ('buildFlags' in project) ? project['buildFlags'][platform][config] : [];
            buildFlagsArray.forEach(item =>
            {
                buildFlagsContent += '					"' + item + '",\n';
            });

            // linkerFlags
            let linkerFlagsContent = '';
            let linkerFlagsArray = ('linkerFlags' in project) ? project['linkerFlags'][platform][config] : [];
            linkerFlagsArray.forEach(item =>
            {
                linkerFlagsContent += '					"' + item + '",\n';
            });

            // apply
            await replace({files: projectFilePath, from: `/*INCLUDES_${configKey}*/`, to: includePathsContent.trim()});
            await replace({files: projectFilePath, from: `/*DEFINES_${configKey}*/`, to: definesContent.trim()});
            await replace({files: projectFilePath, from: new RegExp(`/\\*LIB_PATHS_${configKey}\\*/`, 'g'), to: libPathsContent.trim()});
            await replace({files: projectFilePath, from: `/*BUILD_FLAGS_${configKey}*/`, to: buildFlagsContent.trim()});
            await replace({files: projectFilePath, from: `/*LINKER_FLAGS_${configKey}*/`, to: linkerFlagsContent.trim()});
        }
    }
}

async function applyProjectSettings(projectName, project, options)
{
    let files = [];

    files.push(options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj');
    files.push(options.build.outputPath + '/' + projectName + '.xcodeproj/project.xcworkspace/contents.xcworkspacedata');

    let plistFile = options.build.outputPath + '/' + projectName + '/Info.plist';
    if (fs.existsSync(plistFile))
        files.push(plistFile);

    files.map(file => path.resolve(file));

    for(let settingsKey in options.build)
    {
        let val = options.build[settingsKey];
        if ('settings' in project && settingsKey in project.settings)
            val = project.settings[settingsKey];

        if (typeof val == 'string')
            val = val.trim();

        await replace({files: files, from: new RegExp(`<!--${settingsKey}-->`, 'g'), to: val});
        await replace({files: files, from: new RegExp(`/\\*${settingsKey}\\*/`, 'g'), to: val});
    }

    return true;
}

async function applyIcon(projectName, project, options)
{
    const iconJson = options.build.outputPath + '/' + projectName + '/Assets.xcassets/AppIcon.appiconset/contents.json';

    if (!fs.existsSync(iconJson))
        return true;

    let iconPath = path.resolve(Globals.ICON);
    if ('icon' in project)
    {
        if (path.isAbsolute(project.icon) && fs.existsSync(project.icon))
            iconPath = project.icon;
        else
            iconPath = path.resolve(path.join(path.dirname(options.build.projectPath), project.icon));
    }

    if (!fs.existsSync(iconPath))
    {
        Logging.error('icon file not found: ', iconPath);
        throw Error('icon file not found');
    }

    let iconContent = '';

    for(let idom in Globals.XCODE_ICONS)
    {
        for(let i in Globals.XCODE_ICONS[idom])
        {
            let iconItem = Globals.XCODE_ICONS[idom][i];

            let outputIcon = 'icon_' + iconItem.name + '_' + iconItem.scale + '.png';
            let outputIconPath = path.dirname(iconJson) + '/' + outputIcon;

            await ImageHelper.iconGenerator(iconPath, outputIconPath, iconItem.size);

            iconContent += `    {\n`;
            iconContent += `      "size" : "${iconItem.name}",\n`;
            iconContent += `      "idiom" : "${idom}",\n`;
            iconContent += `      "filename" : "${outputIcon}",\n`;
            iconContent += `      "scale" : "${iconItem.scale}"\n`;
            iconContent += `    },\n`;
        }
    }

    // remove last comma
    if (iconContent.length > 0)
        iconContent = iconContent.substr(0, iconContent.length - 2);

    await replace({files: iconJson, from: `/*ICONS*/`, to: iconContent.trim()});

    return true;
}

async function applyAssets(projectName, project, options)
{
    if (!fs.existsSync(options.build.outputPath + '/' + projectName))
        fs.mkdirSync(options.build.outputPath + '/' + projectName);

    let copyScript = projectName + '/copyAssets.sh';
    let copyScriptOutPath = options.build.outputPath + '/' + copyScript;

    let scriptContent = '';
    scriptContent += 'rm  -rf "' + path.join(projectName, Globals.DEFAULT_ASSET_DIR) + '/"\n';
    scriptContent += 'mkdir "' + path.join(projectName, Globals.DEFAULT_ASSET_DIR) + '/"\n\n';

    // create asset dir
    const assetDir = path.join(options.build.outputPath, projectName, Globals.DEFAULT_ASSET_DIR)
    if (!fs.existsSync(assetDir))
        await fs.mkdirSync(assetDir);

    // generate copy script
    if (!options.build.skipAssets && 'assets' in project)
    {
        for(let i in project.assets)
        {
            let asset = project.assets[i];

            let source = path.resolve(path.join(project.workingDir, asset.source)) + '/';
            let dest = path.join(projectName, Globals.DEFAULT_ASSET_DIR, asset.destination);

            let exclude = '';
            if ('exclude' in asset)
            {
                asset.exclude.forEach(excludeItem =>
                {
                    exclude += `--exclude "${excludeItem}" `;
                });
            }

            let rsync = `rsync -av ${exclude.trim()} "${source}" "${dest}"\n`;
            scriptContent += rsync;
        }
    }

    fs.writeFileSync(copyScriptOutPath, scriptContent);
    fs.chmodSync(copyScriptOutPath, 0o744);

    let projectFilePath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj';
    await replace({files: projectFilePath, from: `/*COPY_ASSETS_SCRIPT*/`, to: copyScript});
}

function applyReplacements(projectName, project, options)
{
    if (!('replacements' in project) || !('plist' in project.replacements))
        return;

    let plistFile = options.build.outputPath + '/' + projectName + '/Info.plist';
    if (!fs.existsSync(plistFile))
        return;

    let plistContent = fs.readFileSync(plistFile).toString();
    let plistObj = plist.parse(plistContent);

    for(let plistKey in project.replacements.plist)
        plistObj[plistKey] = project.replacements.plist[plistKey];

    fs.writeFileSync(plistFile, plist.build(plistObj));
}

async function applyHooks(projectName, projectId, project, options)
{
    let platform0 = options.build.arch[0];
    let config0 = Globals.CONFIGURATIONS[0];

    let schemePath = options.build.outputPath + '/' + projectName + '.xcodeproj/xcshareddata/xcschemes/' + projectName + '.xcscheme';

    let hooks = [{name: 'preBuild', replacementName: 'HOOK_PRE_BUILD'}, {name: 'postBuild', replacementName: 'HOOK_POST_BUILD'}];

    for(let hookI in hooks)
    {
        let hookName = hooks[hookI].name;
        let replacementName = hooks[hookI].replacementName;

        // use first platform/config release
        if (Helper.hasKeys(project, 'hooks', hookName, platform0, config0))
        {
            let hookContent = '';
            for(let i in project['hooks'][hookName][platform0][config0])
            {
                // hook should run in working dir
                let hook = escapeHtml(`cd $\{PROJECT_DIR\}`) + '&#10;';
                hook += escapeHtml(`exec > $\{PROJECT_DIR\}/${projectName}_${hookName}_${i}.log 2>&1`) + '&#10;';
                hook += escapeHtml(project['hooks'][hookName][platform0][config0][i]);

                hookContent += `         <ExecutionAction ActionType = "Xcode.IDEStandardExecutionActionsCore.ExecutionActionType.ShellScriptAction">\n`;
                hookContent += `            <ActionContent title = "${hookName} Script" scriptText = "${hook}">\n`;
                hookContent += `               <EnvironmentBuildable>\n`;
                hookContent += `                  <BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "${projectId}" BuildableName = "${projectName}.app" BlueprintName = "${projectName}" ReferencedContainer = "container:${projectName}.xcodeproj">\n`;
                hookContent += `                  </BuildableReference>\n`;
                hookContent += `               </EnvironmentBuildable>\n`;
                hookContent += `            </ActionContent>\n`;
                hookContent += `         </ExecutionAction>\n`;
            }

            results = await replace({files: schemePath, from: '<!--' + replacementName + '-->', to: hookContent.trim()});
        }
    }
}

module.exports = makeXcode;
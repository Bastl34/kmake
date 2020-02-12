const path = require('path');
const fs = require('fs');

const copy = require('recursive-copy');
const replace = require('replace-in-file');

const Helper = require('../helper/helper');
const FileHelper = require('../helper/fileHelper');
const Logging = require('../helper/logging');
const iconGenerator = require('../helper/iconGenerator');

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
        return '"' + name + "=" + (isStr ? '\\"' + item[name] + '\\"' : item[name]) + '"';
    }

    return '"' + item + '"';
}

async function makeXcode(options)
{
    // ******************** copy projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        let sourcePath = options.build.templatePath + '/' + project.outputType + '.xcodeproj';
        let destPath = options.build.outputPath + '/' + projectName + '.xcodeproj';

        let results = await copy(sourcePath, destPath, {overwrite: true});
        Logging.log(results.length + ' files copied');

        //check and copy extra dependencies
        if (fs.existsSync(options.build.templatePath + '/' + project.outputType))
        {
            sourcePath = options.build.templatePath + '/' + project.outputType;
            destPath = options.build.outputPath + '/' + project.outputType;

            let results = await copy(sourcePath, destPath, {overwrite: true});
            Logging.log(results.length + ' files copied');
        }
    }

    // ******************** generate .xcworkspace ********************
    let sourcePath = options.build.templatePath + '/workspace.xcworkspace';
    let destPath = options.build.outputPath + '/' + options.workspace.name + '.xcworkspace';

    let results = await copy(sourcePath, destPath, {overwrite: true});
    Logging.log(results.length + ' files copied');

    let fileRefStr = '';
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        fileRefStr += '   <FileRef location = "group:' + projectName + '.xcodeproj"></FileRef>\n';
    }

    let workspaceContentFilePath = destPath + '/contents.xcworkspacedata';

    results = await replace({files: workspaceContentFilePath, from: '<!--FileRef-->', to: fileRefStr.trim()});
    Logging.log(results.length + ' files changed');


    // ******************** generate projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        Logging.info('========== ' + projectName + ' ==========');

        if (project.type == 'project' && project.projectType == 'source')
        {
            let libsList = [];
            let soucesList = [];
            let directoryList = {};

            // ********** libs

            //use x86_64 release
            let libs = [];
            if ('dependencies' in project && 'x86_64' in project.dependencies)
                libs = project.dependencies['x86_64']['release'];

            for(let libKey in libs)
            {
                let lib = libs[libKey];

                //let isWorkspaceLib = (lib in options && 'workingDir' in options[lib]);
                let isWorkspaceLib = (options.workspace.content.indexOf(lib) != -1 && 'workingDir' in options[lib]);

                //output name/filename by outputType
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

                //lib
                let libsObj =
                {
                    name: path.basename(lib),
                    isWorkspaceLib: isWorkspaceLib,
                    path: lib,
                    pathRelative: libPathRelative ? libPathRelative : null,
                    uid: Helper.randomString(24, '0123456789ABCDEF', false),
                    uid2: Helper.randomString(24, '0123456789ABCDEF', false),
                    uid3: Helper.randomString(24, '0123456789ABCDEF', false),
                    type: type
                };

                libsList.push(libsObj);
            }

            // ********** files
            project.sources.forEach(file =>
            {
                let type = 'unknown';
                let ext = path.extname(file);
                if (ext in XCODE_SOURCE_FILETYPE_MAP)
                    type = XCODE_SOURCE_FILETYPE_MAP[ext];

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
                    uid: Helper.randomString(24, '0123456789ABCDEF', false),
                    uid2: Helper.randomString(24, '0123456789ABCDEF', false),
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
                    path: dir,
                    uid: Helper.randomString(24, '0123456789ABCDEF', false)
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

            // ********** create xcode project file strings
            let sourceFileContent = '';
            let sourceFileReferenceContent = '';
            let compileFiles = '';
            let headerFiles = '';
            let libList = '';
            let libBuildList = '';
            let libEmbedList = '';

            soucesList.forEach(file =>
            {
                //get the relative path from output dir to source
                let absolutePath = path.resolve(file.path);
                let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + file.name;

                sourceFileContent += '		' + file.uid2 + ' /* ' + file.name + ' in Sources */ = {isa = PBXBuildFile; fileRef = ' + file.uid + ' /* ' + file.name + ' */; };\n';
                sourceFileReferenceContent += '		' + file.uid + ' /* ' + file.name + ' */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = ' + file.type + '; name = ' + file.name + '; path = ' + relativePath + '; sourceTree = "<group>"; };\n';

                //only source files
                if (file.type.indexOf('sourcecode') != -1 && file.type.indexOf('.h') == -1)
                    compileFiles += '				' + file.uid2 + ' /* ' + file.name + ' in Sources */,\n';

                //only header files
                if (file.type.indexOf('.h') != -1)
                    headerFiles += '				' + file.uid2 + ' /* ' + file.name + ' in Sources */,\n';
            });

            // ********** libs
            libsList.forEach(lib =>
            {
                //get the relative path from output dir to source
                let absolutePath = path.resolve(lib.path);
                let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + lib.name;
                if (lib.isWorkspaceLib)
                    relativePath = lib.name;

                sourceFileContent += '		' + lib.uid2 + ' /* ' + lib.name + ' in Frameworks */ = {isa = PBXBuildFile; fileRef = ' + lib.uid + ' /* ' + lib.name + ' */; };\n';

                //add to embed
                if (lib.name.indexOf('dylib') != -1)
                    sourceFileContent += '		' + lib.uid3 + ' /* ' + lib.name + ' in Embed Libraries */ = {isa = PBXBuildFile; fileRef = ' + lib.uid + ' /* ' + lib.name + ' */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };\n';

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

                sourceFileReferenceContent += '		' + lib.uid + ' /* ' + lib.name + ' */ = {isa = PBXFileReference; ' + fileTypeStr + '; name = ' + lib.name + '; path = ' + relativePath + '; sourceTree = ' + sourceTree + '; };\n';


                //add to "framework" group
                libList += '				' + lib.uid + ' /* ' + lib.name + ' in Frameworks */,\n';

                //add to build step
                libBuildList += '				' + lib.uid2 + ' /* ' + lib.name + ' in Frameworks */,\n';

                //add to embed
                if (lib.name.indexOf('dylib') != -1)
                    libEmbedList += '				' + lib.uid3 + ' /* ' + lib.name + ' in Embed Libraries */,\n';
            });


            // ********** source groups folders
            let sourceDirectories = '';
            directoryList.forEach(directory =>
            {
                //get containing dirs
                let containingDirs = [];
                directoryList.forEach(innerDir =>
                {
                    if (FileHelper.isSubdirectory(directory.path, innerDir.path))
                        containingDirs.push(innerDir);
                });

                //get containing files
                let containingFiles = [];
                soucesList.forEach(innerFile =>
                {
                    if (FileHelper.isSubdirectory(directory.path, innerFile.pathRelative))
                        containingFiles.push(innerFile);
                });

                //add to SOURCE_DIRECTORIES
                sourceDirectories += '		' + directory.uid + ' /* ' + directory.name + ' */ = {\n';
                sourceDirectories += '			isa = PBXGroup;\n';
                sourceDirectories += '			children = (\n';

                containingDirs.forEach(cDir =>
                {
                    sourceDirectories += '				' + cDir.uid + ' /* ' + cDir.name + ' */,\n';
                });

                containingFiles.forEach(cFile =>
                {
                    sourceDirectories += '				' + cFile.uid + ' /* ' + cFile.name + ' */,\n';
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
                    sourceRoot += '				' + directory.uid + ' /* ' + directory.name + ' */,\n';
            });
            soucesList.forEach(file =>
            {
                if (FileHelper.countDirectoryLevels(file.pathRelative) == 1)
                    sourceRoot += '				' + file.uid + ' /* ' + file.name + ' */,\n';
            });

            // ********** replacements
            let projectFilePath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj';
            let workspaceContentPath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.xcworkspace/contents.xcworkspacedata';

            results = await replace({files: projectFilePath, from: /PROJECT_NAME/g, to: projectName});
            results = await replace({files: workspaceContentPath, from: /PROJECT_NAME/g, to: projectName});

            results = await replace({files: projectFilePath, from: '/*SOURCE_FILE_REFERENCE*/', to: sourceFileReferenceContent.trim()});
            results = await replace({files: projectFilePath, from: '/*SOURCE_FILE*/', to: sourceFileContent.trim()});
            results = await replace({files: projectFilePath, from: '/*COMPILE_FILES*/', to: compileFiles.trim()});
            results = await replace({files: projectFilePath, from: '/*HEADER_FILES*/', to: headerFiles.trim()});
            results = await replace({files: projectFilePath, from: '/*SOURCE_DIRECTORIES*/', to: sourceDirectories.trim()});
            results = await replace({files: projectFilePath, from: '/*SOURCE_ROOT*/', to: sourceRoot.trim()});
            results = await replace({files: projectFilePath, from: '/*LIBRARIES_LIST*/', to: libList.trim()});
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
        }
    }

    return true;
}

async function applyPlatformData(projectName, project, options)
{
    let projectFilePath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj';

    //Globals.PLATFORMS[options.build.template].forEach(platform =>
    for(let platformI in Globals.PLATFORMS[options.build.template])
    {
        let platform = Globals.PLATFORMS[options.build.template][platformI];

        //Globals.CONFIGURATIONS.forEach(config =>
        for(let configI in Globals.CONFIGURATIONS)
        {
            let config = Globals.CONFIGURATIONS[configI];
            let configKey = config.toUpperCase();

            //include
            let includePathsContent = '';
            let includesArray = ('includePaths' in project) ? project['includePaths'][platform][config] : [];
            includesArray.forEach(item =>
            {
                item = FileHelper.relative(options.build.outputPath, item);
                includePathsContent += '					"' + item + '",\n';
            });


            //defines
            let definesContent = '';
            let definesArray = ('defines' in project) ? project['defines'][platform][config] : [];
            definesArray.forEach(item =>
            {
                definesContent += '					' + getDefineEntry(item) + ',\n';
            });

            //libPaths
            let libPathsContent = '';
            let libsPathsArray = ('libPaths' in project) ? project['libPaths'][platform][config] : [];
            libsPathsArray.forEach(item =>
            {
                item = FileHelper.relative(options.build.outputPath, item);
                libPathsContent += '					"' + item + '",\n';
            });

            //buildFlags
            let buildFlagsContent = '';
            let buildFlagsArray = ('buildFlags' in project) ? project['buildFlags'][platform][config] : [];
            buildFlagsArray.forEach(item =>
            {
                buildFlagsContent += '					"' + item + '",\n';
            });

            //linkerFlags
            let linkerFlagsContent = '';
            let linkerFlagsArray = ('linkerFlags' in project) ? project['linkerFlags'][platform][config] : [];
            linkerFlagsArray.forEach(item =>
            {
                linkerFlagsContent += '					"' + item + '",\n';
            });

            //apply
            await replace({files: projectFilePath, from: `/*DEFINES_${configKey}*/`, to: definesContent.trim()});
            await replace({files: projectFilePath, from: new RegExp(`/\\*LIB_PATHS_${configKey}\\*/`, 'g'), to: libPathsContent.trim()});
            await replace({files: projectFilePath, from: `/*INCLUDES_${configKey}*/`, to: includePathsContent.trim()});
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

    let plist = options.build.outputPath + '/' + projectName + '/Info.plist';
    if (fs.existsSync(plist))
        files.push(plist);

    files.map(file => path.resolve(file));

    for(let settingsKey in Globals.DEFAULT_BUILD_SETTINGS)
    {
        let val = Globals.DEFAULT_BUILD_SETTINGS[settingsKey];
        if ('settings' in project && settingsKey in project.settings)
            val = project.settings[settingsKey];

        await replace({files: files, from: new RegExp(`/\\*${settingsKey}\\*/`, 'g'), to: val.trim()});
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

            await iconGenerator(iconPath, outputIconPath, iconItem.size);

            iconContent += `    {\n`;
            iconContent += `      "size" : "${iconItem.name}",\n`;
            iconContent += `      "idiom" : "${idom}",\n`;
            iconContent += `      "filename" : "${outputIcon}",\n`;
            iconContent += `      "scale" : "${iconItem.scale}"\n`;
            iconContent += `    },\n`;
        }
    }

    //remove last comma
    if (iconContent.length > 0)
        iconContent = iconContent.substr(0, iconContent.length - 2);

    await replace({files: iconJson, from: `/*ICONS*/`, to: iconContent.trim()});

    return true;
}

module.exports = makeXcode;
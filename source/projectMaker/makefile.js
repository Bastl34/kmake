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

/*
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
*/

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

        //let soucesList = [];

        /*
        let libsList = [];
        let soucesList = [];
        let directoryList = {};
        */

        // ********** libs

        /*
        //use x86_64 release
        let libs = [];
        if ('dependencies' in project && 'x86_64' in project.dependencies)
            libs = project.dependencies['x86_64']['release'];

        for(let libKey in libs)
        {
            let lib = libs[libKey];

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
        */

        // ********** files
        /*
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

            sourceFileContent += '		' + file.uid2 + ' / ' + file.name + ' in Sources / = {isa = PBXBuildFile; fileRef = ' + file.uid + ' / ' + file.name + ' /; };\n';
            sourceFileReferenceContent += '		' + file.uid + ' / ' + file.name + ' / = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = ' + file.type + '; name = ' + file.name + '; path = ' + relativePath + '; sourceTree = "<group>"; };\n';

            //only source files
            if (file.type.indexOf('sourcecode') != -1 && file.type.indexOf('.h') == -1)
                compileFiles += '				' + file.uid2 + ' / ' + file.name + ' in Sources /,\n';

            //only header files
            if (file.type.indexOf('.h') != -1)
                headerFiles += '				' + file.uid2 + ' / ' + file.name + ' in Sources /,\n';
        });

        // ********** libs
        libsList.forEach(lib =>
        {
            //get the relative path from output dir to source
            let absolutePath = path.resolve(lib.path);
            let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + lib.name;
            if (lib.isWorkspaceLib)
                relativePath = lib.name;

            sourceFileContent += '		' + lib.uid2 + ' / ' + lib.name + ' in Frameworks / = {isa = PBXBuildFile; fileRef = ' + lib.uid + ' / ' + lib.name + ' /; };\n';

            //add to embed
            if (lib.name.indexOf('dylib') != -1)
                sourceFileContent += '		' + lib.uid3 + ' / ' + lib.name + ' in Embed Libraries / = {isa = PBXBuildFile; fileRef = ' + lib.uid + ' / ' + lib.name + ' /; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };\n';

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

            sourceFileReferenceContent += '		' + lib.uid + ' / ' + lib.name + ' / = {isa = PBXFileReference; ' + fileTypeStr + '; name = ' + lib.name + '; path = ' + relativePath + '; sourceTree = ' + sourceTree + '; };\n';


            //add to "framework" group
            libList += '				' + lib.uid + ' / ' + lib.name + ' in Frameworks /,\n';

            //add to build step
            libBuildList += '				' + lib.uid2 + ' / ' + lib.name + ' in Frameworks /,\n';

            //add to embed
            if (lib.name.indexOf('dylib') != -1)
                libEmbedList += '				' + lib.uid3 + ' / ' + lib.name + ' in Embed Libraries /,\n';
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
            sourceDirectories += '		' + directory.uid + ' / ' + directory.name + ' / = {\n';
            sourceDirectories += '			isa = PBXGroup;\n';
            sourceDirectories += '			children = (\n';

            containingDirs.forEach(cDir =>
            {
                sourceDirectories += '				' + cDir.uid + ' / ' + cDir.name + ' /,\n';
            });

            containingFiles.forEach(cFile =>
            {
                sourceDirectories += '				' + cFile.uid + ' / ' + cFile.name + ' /,\n';
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
                sourceRoot += '				' + directory.uid + ' / ' + directory.name + ' /,\n';
        });
        soucesList.forEach(file =>
        {
            if (FileHelper.countDirectoryLevels(file.pathRelative) == 1)
                sourceRoot += '				' + file.uid + ' / ' + file.name + ' /,\n';
        });
        */

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
            let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(absolutePath)) + '/' + file;
            let outPath = path.join(Globals.DEFAULT_OUTPUT_DIR, relativePath.replace(/\.\.\//g, '')) + '.o';

            sourceFileContent += `${outPath}: ${relativePath}\n`;
            sourceFileContent += `    $(CC) $(SO_FLAGS) $(CPPFLAGS) ${relativePath} -o ${outPath} $(LDFLAGS)\n\n`;
        });

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

        // ********** replacements
        Logging.log('generating ' + projectName + '.mk');
        let projectFilePath = options.build.outputPath + '/' + projectName + '.mk';

        //results = await replace({files: projectFilePath, from: /PROJECT_ID/g, to: projectId});
        //results = await replace({files: workspaceContentPath, from: /PROJECT_ID/g, to: projectId});
        //results = await replace({files: schemePath, from: /PROJECT_ID/g, to: projectId});

        //results = await replace({files: projectFilePath, from: /PROJECT_NAME/g, to: projectName});
        //results = await replace({files: workspaceContentPath, from: /PROJECT_NAME/g, to: projectName});
        //results = await replace({files: schemePath, from: /PROJECT_NAME/g, to: projectName});

        //results = await replace({files: projectFilePath, from: '/SOURCE_FILE_REFERENCE/', to: sourceFileReferenceContent.trim()});
        results = await replace({files: projectFilePath, from: '#SOURCE_FILE#', to: sourceFileContent.trim()});
        //results = await replace({files: projectFilePath, from: '/COMPILE_FILES/', to: compileFiles.trim()});
        //results = await replace({files: projectFilePath, from: '/HEADER_FILES/', to: headerFiles.trim()});
        //results = await replace({files: projectFilePath, from: '/SOURCE_DIRECTORIES/', to: sourceDirectories.trim()});
        //results = await replace({files: projectFilePath, from: '/SOURCE_ROOT/', to: sourceRoot.trim()});
        //results = await replace({files: projectFilePath, from: '/LIBRARIES_LIST/', to: libList.trim()});
        //results = await replace({files: projectFilePath, from: '/LIBRARIES_BUILD/', to: libBuildList.trim()});
        //results = await replace({files: projectFilePath, from: '/EMBED_LIBRARIES/', to: libEmbedList.trim()});


        /*
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

module.exports = makeMakefile;
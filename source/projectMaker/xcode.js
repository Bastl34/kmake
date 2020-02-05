const path = require('path');

const copy = require('recursive-copy');
const replace = require('replace-in-file');

const Helper = require('../helper/helper');
const FileHelper = require('../helper/fileHelper');

const Globals = require('../globals');

const XCODE_FILETYPE_MAP =
{
    ".cpp": "sourcecode.cpp.cpp",
    ".hpp": "sourcecode.cpp.hpp",
    ".h": "sourcecode.c.h",
    ".c": "sourcecode.c.c",
    ".mm": "sourcecode.cpp.objcpp",
    ".cpp": "sourcecode.cpp.cpp",

    "unknown": "text"
};

function getDefineEntry(item)
{
    if (!item)
        return "";

    if (item instanceof Object)
    {
        let name = Object.keys(item)[0];
        let isStr = typeof item[name] === 'string'
        return name + "=" + (isStr ? '\'\\"' + item[name] + '\\"\'' : item[name])
    }

    return item
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
        console.log(results.length + ' files copied');
    };

    // ******************** generate .xcworkspace ********************
    let sourcePath = options.build.templatePath + '/workspace.xcworkspace';
    let destPath = options.build.outputPath + '/' + options.workspace.name + '.xcworkspace';

    let results = await copy(sourcePath, destPath, {overwrite: true});
    console.log(results.length + ' files copied');

    let fileRefStr = '';
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        fileRefStr += '   <FileRef location = "group:' + projectName + '.xcodeproj"></FileRef>\n'
    }

    let workspaceContentFilePath = destPath + '/contents.xcworkspacedata';

    results = await replace({files: workspaceContentFilePath, from: '<!--FileRef-->', to: fileRefStr.trim()});
    console.log(results.length + ' files changed');


    // ******************** generate projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        if (project.type == 'project' && project.projectType == 'source')
        {
            let soucesList = [];
            let directoryList = {};

            // ********** files
            project.sources.forEach(file =>
            {
                let type = 'unknown';
                let ext = path.extname(file);
                if (ext in XCODE_FILETYPE_MAP)
                    type = XCODE_FILETYPE_MAP[ext];

                //dirs
                let directory = path.dirname(file);

                //get relative paths
                if (project.workingDir && project.workingDir.length > 0)
                    directory = directory.substr(project.workingDir.length+1);

                let filePathRelative = file;
                if (project.workingDir && project.workingDir.length > 0)
                filePathRelative = filePathRelative.substr(project.workingDir.length+1);

                if (directory)
                {
                    directoryList[directory] = true;

                    //add all subdir's
                    let subDirs = FileHelper.getAllParentDirectoryPaths(directory);
                    subDirs.forEach(subDir => { directoryList[subDir] = true; })
                }

                //file
                let sourceObj =
                {
                    name: path.basename(file),
                    path: file,
                    pathRelative: filePathRelative,
                    dir: directory,
                    uid: Helper.randomString(24,"0123456789ABCDEF", false),
                    uid2: Helper.randomString(24,"0123456789ABCDEF", false),
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
                    uid: Helper.randomString(24,"0123456789ABCDEF", false),
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
            let sourceFileContent = "";
            let sourceFileReferenceContent = "";
            let compileFiles = "";

            soucesList.forEach(file =>
            {
                //get the relative path from output dir to source
                let relativePath = FileHelper.relative(options.build.outputPath, path.dirname(file.path)) + '/' + file.name;

                sourceFileContent += '		'+file.uid2+' /* '+file.name+' in Sources */ = {isa = PBXBuildFile; fileRef = '+file.uid+' /* '+file.name+' */; };\n';
                sourceFileReferenceContent += '		'+file.uid+' /* '+file.name+' */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = '+file.type+'; name = '+file.name+'; path = '+relativePath+'; sourceTree = "<group>"; };\n';

                //only source files
                if (file.type.indexOf('sourcecode') != -1)
                    compileFiles += '				'+file.uid2+' /* '+file.name+' in Sources */,\n';
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
                sourceDirectories += "		"+directory.uid+" /* "+directory.name+" */ = {\n";
                sourceDirectories += "			isa = PBXGroup;\n";
                sourceDirectories += "			children = (\n";

                containingDirs.forEach(cDir =>
                {
                    sourceDirectories += "				"+cDir.uid+" /* "+cDir.name+" */,\n";
                });

                containingFiles.forEach(cFile =>
                {
                    sourceDirectories += "				"+cFile.uid+" /* "+cFile.name+" */,\n";
                });

                sourceDirectories += "			);\n";
                sourceDirectories += "			name = "+directory.name+";\n";
                sourceDirectories += "			sourceTree = \"<group>\";\n";
                sourceDirectories += "		};\n";
            });

            // ********** root source files/directories
            let sourceRoot = '';
            directoryList.forEach(directory =>
            {
                if (FileHelper.countDirectoryLevels(directory.path) == 1)
                    sourceRoot += "				"+directory.uid+" /* "+directory.name+" */,\n";
            });
            soucesList.forEach(file =>
            {
                if (FileHelper.countDirectoryLevels(file.pathRelative) == 1)
                    sourceRoot += "				"+file.uid+" /* "+file.name+" */,\n";
            });

            // ********** replacements
            let projectFilePath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj';
            let workspaceContentPath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.xcworkspace/contents.xcworkspacedata';

            results = await replace({files: projectFilePath, from: /PROJECT_NAME/g, to: projectName});
            results = await replace({files: workspaceContentPath, from: /PROJECT_NAME/g, to: projectName});

            results = await replace({files: projectFilePath, from: '/*SOURCE_FILE_REFERENCE*/', to: sourceFileReferenceContent.trim()});
            results = await replace({files: projectFilePath, from: '/*SOURCE_FILE*/', to: sourceFileContent.trim()});
            results = await replace({files: projectFilePath, from: '/*COMPILE_FILES*/', to: compileFiles.trim()});
            results = await replace({files: projectFilePath, from: '/*SOURCE_DIRECTORIES*/', to: sourceDirectories.trim()});
            results = await replace({files: projectFilePath, from: '/*SOURCE_ROOT*/', to: sourceRoot.trim()});

            // ********** platform specific data
            await applyPlatformData(projectName, project, options)
        }
    }
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
            let configKey = config.toUpperCase()

            //include
            let includePathsContent = "";
            let includesArray = ('includePaths' in project) ? project['includePaths'][platform][config] : [];
            includesArray.forEach(item =>
            {
                includePathsContent += '					"' + item + '",\n';
            });


            //defines
            let definesContent = "";
            let definesArray = ('defines' in project) ? project['defines'][platform][config] : [];
            definesArray.forEach(item =>
            {
                definesContent += '					' + getDefineEntry(item) + ',\n';
            });

            //include
            let libPathsContent = "";
            let libsPathsArray = ('libPaths' in project) ? project['libPaths'][platform][config] : [];
            libsPathsArray.forEach(item =>
            {
                libPathsContent += '					"' + item + '",\n';
            });

            //buildFlags
            let buildFlagsContent = "";
            let buildFlagsArray = ('buildFlags' in project) ? project['buildFlags'][platform][config] : [];
            buildFlagsArray.forEach(item =>
            {
                buildFlagsContent += '					"' + item + '",\n';
            });

            //linkerFlags
            let linkerFlagsContent = "";
            let linkerFlagsArray = ('linkerFlags' in project) ? project['linkerFlags'][platform][config] : [];
            linkerFlagsArray.forEach(item =>
            {
                linkerFlagsContent += '					"' + item + '",\n';
            });

            //apply
            let results = await replace({files: projectFilePath, from: `/*DEFINES_${configKey}*/`, to: definesContent.trim()});
            results = await replace({files: projectFilePath, from: new RegExp(`/\\*LIB_PATHS_${configKey}\\*/`, 'g'), to: libPathsContent.trim()});
            results = await replace({files: projectFilePath, from: `/*INCLUDES_${configKey}*/`, to: includePathsContent.trim()});
            results = await replace({files: projectFilePath, from: `/*BUILD_FLAGS_${configKey}*/`, to: buildFlagsContent.trim()});
            results = await replace({files: projectFilePath, from: `/*LINKER_FLAGS_${configKey}*/`, to: linkerFlagsContent.trim()});
        }
    }
}

module.exports = makeXcode;
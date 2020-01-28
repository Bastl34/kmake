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


    // ******************** apply source files ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        if (project.type == 'project' && project.projectType == 'source')
        {
            let soucesList = [];
            let directoryList = {};

            // ***** files
            project.sources.forEach(file =>
            {
                let type = 'unknown';
                let ext = path.extname(file);
                if (ext in XCODE_FILETYPE_MAP)
                    type = XCODE_FILETYPE_MAP[ext];

                //dirs
                let directory = path.dirname(file);

                if (project.workingDir && project.workingDir.length > 0)
                    directory = directory.substr(project.workingDir.length+1);

                if (directory)
                    directoryList[directory] = true;
                
                //file
                let sourceObj =
                {
                    name: path.basename(file),
                    path: file,
                    dir: directory,
                    uid: Helper.randomString(24,"0123456789ABCDEF", false),
                    uid2: Helper.randomString(24,"0123456789ABCDEF", false),
                    type: type
                };

                soucesList.push(sourceObj);
            });

            //make array out of directory list
            directoryList = Object.keys(directoryList);

            // ***** direcotires
            directoryList.forEach(dir =>
            {
                //file
                let sourceObj =
                {
                    name: path.basename(dir),
                    path: dir,
                    uid: Helper.randomString(24,"0123456789ABCDEF", false),
                };                
            });

            //sort
            soucesList.sort();
            directoryList.sort();


            //create xcode project file strings
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

            let projectFilePath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj';

            results = await replace({files: projectFilePath, from: '/*SOURCE_FILE_REFERENCE*/', to: sourceFileReferenceContent.trim()});
            results = await replace({files: projectFilePath, from: '/*SOURCE_FILE*/', to: sourceFileContent.trim()});
            results = await replace({files: projectFilePath, from: '/*COMPILE_FILES*/', to: compileFiles.trim()});
            
            console.log(sourceFileReferenceContent);
        }
    }
}

module.exports = makeXcode;
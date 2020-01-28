const path = require('path');

const copy = require('recursive-copy');
const replace = require('replace-in-file');

const Helper = require('../helper/helper');

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

            project.sources.forEach(file =>
            {
                let type = 'unknown';
                let ext = path.extname(file);
                if (ext in XCODE_FILETYPE_MAP)
                    type = XCODE_FILETYPE_MAP[ext];

                //TODO: path relative to source (if possible)


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
                    uid1: Helper.randomString(24,"0123456789ABCDEF", false),
                    uid2: Helper.randomString(24,"0123456789ABCDEF", false),
                    type: type
                };

                soucesList.push(sourceObj);
            });

            //make array out of directory list
            directoryList = Object.keys(directoryList);
            console.log(directoryList);
        }
    }
}

module.exports = makeXcode;
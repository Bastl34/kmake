const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const Globals = require('./globals')

const FileHelper = require('./helper/fileHelper');

function ymlLoader(ymlPath, workingDir = null)
{
    let fileContent = fs.readFileSync(ymlPath, 'utf8');

    if (!fileContent)
        fileContent = {};

    const parsed = yaml.safeLoad(fileContent);

    let content = {...parsed};
    delete content.imports;

    content = addWorkingDir(content, workingDir);

    content['projectFiles'] = [ymlPath];

    // load imports
    if ('imports' in parsed)
    {
        let parentYmlPath = path.dirname(ymlPath);

        let imports = parsed.imports;
        imports.forEach(importFile =>
        {
            let importPath = parentYmlPath + '/' + importFile;
            if(path.isAbsolute(importFile))
                importPath = importFile;

            let importOptions = ymlLoader(importPath, path.dirname(importPath));

            let projectFiles = [...content.projectFiles, ...importOptions.projectFiles];

            content = {...content, ...importOptions};
            content.projectFiles = projectFiles;
        });
    }

    return content;
}

function addWorkingDir(options, dir)
{
    // add working dir only for type=project
    if (options)
    {
        for(let key in options)
        {
            // only for projects
            let isIndex = !isNaN(parseInt(key));
            let isProject = Globals.MAIN_CONFIG_ITEMS.indexOf(key) === -1;

            let item = options[key];
            if (item instanceof Object && isProject && !isIndex && !item.workingDir)
                item.workingDir = FileHelper.normalize(dir);
        }
    }

    return options;
}

module.exports = ymlLoader;
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

function ymlLoader(ymlPath)
{
    console.log(ymlPath)

    const fileContent = fs.readFileSync(ymlPath, 'utf8');
    const parsed = yaml.safeLoad(fileContent);

    let content = parsed;

    //load imports
    if ('import' in parsed)
    {
        let parentYmlPath = path.dirname(ymlPath)

        let imports = parsed.import;
        imports.forEach(importFile =>
        {
            let importPath = parentYmlPath + '/' + importFile;
            if(path.isAbsolute(importFile))
                importPath = importFile;

            importOptions = ymlLoader(importPath);

            content = {...content, ...importOptions};
            
        });
    }

    return content
}

module.exports = ymlLoader;
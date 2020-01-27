const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

function ymlLoader(ymlPath)
{
    const fileContent = fs.readFileSync(ymlPath, 'utf8');
    const parsed = yaml.safeLoad(fileContent);

    let content = {...parsed};
    delete content.imports;

    //load imports
    if ('imports' in parsed)
    {
        let parentYmlPath = path.dirname(ymlPath)

        let imports = parsed.imports;
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
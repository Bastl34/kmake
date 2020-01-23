const yaml = require('js-yaml');
const fs   = require('fs');

if (process.argv.length < 5)
{
    console.log('kmake project.yml template outputdir');
    process.exit();
}

let yamlPath = process.argv[2];
let template = process.argv[3];
let outputPath = process.argv[4];

// ******************** find yaml ********************
let fileStat;
try { fileStat = fs.statSync(yamlPath) }
catch(e) {}

if (!fileStat || !fileStat.isFile())
{
    yamlPath += '/kmake.yml' ;

    fileStat = null;
    try { fileStat = fs.statSync(yamlPath) }
    catch(e) {}

    if (!fileStat || !fileStat.isFile())
    {
        console.log('yaml not found');
        process.exit();
    }
}

// ******************** find template ********************
const templatePath = __dirname + '/';
try
{
    let fileStat = fs.statSync(templatePath);
    if (!fileStat.isDirectory())
    {
        console.log('template: ' + template + ' not found');
        process.exit();
    }
}
catch(e)
{
    console.log('template: ' + template + ' not found');
    process.exit();
}

// ******************** find output ********************


// ******************** make ********************

console.log('yaml: ' + yamlPath);
console.log('template: ' + template);
console.log('outputPath: ' + outputPath);

console.log('loading ' + yamlPath);

try
{
    const doc = yaml.safeLoad(fs.readFileSync(yamlPath, 'utf8'));
} catch (e)
{
    console.log(e);
    process.exit();
}
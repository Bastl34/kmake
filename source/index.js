const fs = require('fs');
const path = require('path');

const config = require('./config');
const ymlLoader = require('./ymlLoader');

const kmakeRoot = fs.realpathSync(__dirname + '/..');

if (process.argv.length < 5)
{
    console.log('kmake project.yml template outputdir');
    process.exit();
}

let yamlPath = process.argv[2];
let template = process.argv[3];
let output = process.argv[4];

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
        console.error('yaml not found');
        process.exit();
    }
}

// ******************** find template ********************
let templatePath = kmakeRoot + '/' + config.TEMPLATE_DIR +  '/' + template;
if(path.isAbsolute(template))
    templatePath = template;

try
{
    let fileStat = fs.statSync(templatePath);
    if (!fileStat.isDirectory())
    {
        console.error('template: ' + template + ' not found');
        process.exit();
    }
}
catch(e)
{
    console.error('template: ' + template + ' not found');
    process.exit();
}

// ******************** find output ********************
let outputPath = kmakeRoot + '/' + output;
if(path.isAbsolute(output))
    outputPath = output;

try
{
    if (!fs.existsSync(outputPath))
        fs.mkdirSync(outputPath);
}
catch(e)
{
    console.log(e);
    console.error('error while creating output dir: ' + outputPath);
    process.exit();
}

// ******************** load yaml ********************

let options = {};

try
{
    options = ymlLoader(yamlPath);

    console.log(options);
} catch (e)
{
    console.error(e);
    process.exit();
}



// ******************** make ********************

/*
console.log('yaml: ' + yamlPath);
console.log('template: ' + template);
console.log('outputPath: ' + outputPath);

try
{
    const options = yaml.safeLoad(fs.readFileSync(yamlPath, 'utf8'));
} catch (e)
{
    console.error(e);
    process.exit();
}
*/
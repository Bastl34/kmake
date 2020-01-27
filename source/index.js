const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const readlineSync = require('readline-sync');

const Helper = require('./helper/helper');

const Globals = require('./globals');
const ymlLoader = require('./ymlLoader');
const make = require('./make');

const kmakeRoot = fs.realpathSync(__dirname + '/..');

if (process.argv.length < 5)
{
    console.log('kmake project.yml template outputdir');
    process.exit();
}

let yamlPath = process.argv[2];
let template = process.argv[3];
let output = process.argv[4];

//DEBUG
const useInputCache = true;

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
let templatePath = kmakeRoot + '/' + Globals.TEMPLATE_DIR +  '/' + template;
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
    console.error('error while creating output dir: ' + outputPath);
    console.log(e);
    process.exit();
}

// ******************** load yaml ********************

let options = {};

try
{
    options = ymlLoader(yamlPath);

    //console.log(options);
} catch (e)
{
    console.error(e);
    process.exit();
}


// ******************** get inputs ********************

if ('inputs' in options)
{
    try
    {
        //save input cache
        let inputCachePath = yamlPath + '.input.cache';

        let inputCache = {};

        if (fs.existsSync(inputCachePath))
            inputCache = importOptions = ymlLoader(inputCachePath);

        if (!useInputCache)
        {
            options.inputs.forEach(inputVar =>
            {
                let nameStr = inputVar + ': ';
                if (inputVar in inputCache)
                    nameStr = inputVar + ' (' + inputCache[inputVar] + '): ';

                //read value
                let value = readlineSync.question(nameStr);

                if (!value && inputVar in inputCache)
                    value = inputCache[inputVar];

                if (value)
                {
                    options.inputs[inputVar] = value;
                    inputCache[inputVar] = value;
                }

                console.log(' --> ' + value);
            });
        }
        else
        {
            options.inputs.forEach(inputVar =>
            {
                //read value from cache
                let value = null;
                if (inputVar in inputCache)
                    value = inputCache[inputVar];

                console.log(inputVar + ': ' + value);
            });
        }

        //saving input data
        let dump = yaml.safeDump(inputCache);
        fs.writeFileSync(inputCachePath, dump);
    }
    catch(e)
    {
        console.error('error reading input variables ');
        console.log(e);
        process.exit();
    }
}

// ******************** process variables ********************

Helper.recursiveReplace(options, (key, object) =>
{
    if (typeof object === "string")
    {
        for(let varName in options.variables)
        {
            let replacement = '\\${' + varName + '}';
            let regex = new RegExp(replacement, 'g');
            object = object.replace(regex, options.variables[varName]);
        }
    }

    return object;
});


// ******************** make ********************

(async () =>
{
    try
    {
        options.build =
        {
            template: template,
            templatePath: templatePath,
            output: output,
            outputPath: outputPath,
        };

        await make(options);
    }
    catch (e)
    {
        console.log("make failed");
        console.log(e);
    }
})()

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
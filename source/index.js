const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');
const readlineSync = require('readline-sync');

const Helper = require('./helper/helper');
const FileHelper = require('./helper/fileHelper');
const Logging = require('./helper/logging');

const Globals = require('./globals');
const ymlLoader = require('./ymlLoader');
const platformResolver = require('./platformResolver');
const make = require('./make');

const kmakeRoot = fs.realpathSync(__dirname + '/..');

if (process.argv.length < 5)
{
    Logging.info('kmake project.yml template outputdir');
    process.exit();
}

let projectPath = process.argv[2];
let template = process.argv[3];
let output = process.argv[4];

//DEBUG
const useInputCache = true;
const cleanOutputDir = true;

// ******************** find yaml ********************
let fileStat;
try { fileStat = fs.statSync(projectPath) }
catch(e) {}

if (!fileStat || !fileStat.isFile())
{
    projectPath += '/kmake.yml' ;

    fileStat = null;
    try { fileStat = fs.statSync(projectPath) }
    catch(e) {}

    if (!fileStat || !fileStat.isFile())
    {
        Logging.error('yaml not found');
        process.exit();
    }
}

// ******************** find template ********************
template = template.toLocaleLowerCase();
if (!(template in Globals.TEMPLATES))
{
    Logging.error('template: ' + template + ' not found');
    process.exit();
}

template = Globals.TEMPLATES[template];

let templatePath = kmakeRoot + '/' + Globals.TEMPLATE_DIR +  '/' + template;
if(path.isAbsolute(template))
    templatePath = template;

try
{
    let fileStat = fs.statSync(templatePath);
    if (!fileStat.isDirectory())
    {
        Logging.error('template: ' + template + ' not found');
        process.exit();
    }
}
catch(e)
{
    Logging.error('template: ' + template + ' not found');
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
    Logging.error('error while creating output dir: ' + outputPath);
    Logging.log(e);
    process.exit();
}

// ******************** load yaml ********************

let options = {};

try
{
    options = ymlLoader(projectPath);
} catch (e)
{
    Logging.error(e);
    process.exit();
}

// ******************** build settings ********************
options.build =
{
    template: template,
    templatePath: FileHelper.normalize(templatePath),
    project: projectPath,
    projectPath: FileHelper.normalize(kmakeRoot + '/' + projectPath),
    output: output,
    outputPath: FileHelper.normalize(outputPath),
    useInputCache: useInputCache,
    cleanOutputDir: cleanOutputDir
};

// ******************** get inputs ********************

if ('inputs' in options)
{
    try
    {
        //save input cache
        let inputCachePath = projectPath + '.input.cache';

        let inputCache = {};

        if (fs.existsSync(inputCachePath))
            inputCache = importOptions = ymlLoader(inputCachePath);

        if (!useInputCache)
        {
            for(let key in options.inputs)
            {
                let inputVar = options.inputs[key];

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

                Logging.log(' --> ' + value);
            }
        }
        else
        {
            for(let key in options.inputs)
            {
                let inputVar = options.inputs[key];

                //read value from cache
                let value = null;
                if (inputVar in inputCache)
                    value = inputCache[inputVar];

                    Logging.log(inputVar + ': ' + value);
            }
        }

        //saving input data
        let dump = yaml.safeDump(inputCache);
        fs.writeFileSync(inputCachePath, dump);
    }
    catch(e)
    {
        Logging.error('error reading input variables ');
        Logging.log(e);
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

// ******************** resolve platforms/architectures ********************
options = platformResolver(options, options.build);

// ******************** resolve source files ********************

for(let itemKey in options)
{
    let item = options[itemKey];
    if ('sources' in item)
    {
        let sources = [];

        let workingDir = item.workingDir;

        for(let key in item.sources)
        {
            let file = item.sources[key];
            let filePath = workingDir + '/' + file;
            let files = glob.sync(filePath);

            files = files.map(file => { return FileHelper.normalize(file); })
            sources = [...sources, ...files];
        }

        item.sources = sources;
    }
}


// ******************** make ********************

(async () =>
{
    try
    {
        await make(options);

    }
    catch (e)
    {
        logging.error("make failed");
        logging.log(e);
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
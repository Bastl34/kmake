const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');
const readlineSync = require('readline-sync');

const Helper = require('./helper/helper');
const FileHelper = require('./helper/fileHelper');
const Logging = require('./helper/logging');
const argParser = require('./argParser');

const Globals = require('./globals');
const ymlLoader = require('./ymlLoader');
const platformResolver = require('./platformResolver');
const make = require('./make');
const build = require('./build');

const kmakeRoot = fs.realpathSync(__dirname + '/..');

//parse commandline arguments
let args = argParser();


// ******************** find yaml ********************
let fileStat;
try { fileStat = fs.statSync(args.project); }
catch(e) {}

if (!fileStat || !fileStat.isFile())
{
    args.project += '/kmake.yml' ;

    fileStat = null;
    try { fileStat = fs.statSync(args.project); }
    catch(e) {}

    if (!fileStat || !fileStat.isFile())
    {
        Logging.error('yaml not found');
        process.exit();
    }
}


// ******************** find template ********************
args.template = args.template.toLocaleLowerCase();
if (!(args.template in Globals.TEMPLATES))
{
    Logging.error('template: ' + args.template + ' not found');
    process.exit();
}

args.template = Globals.TEMPLATES[args.template];

let templatePath = kmakeRoot + '/' + Globals.TEMPLATE_DIR +  '/' + args.template;
if(path.isAbsolute(args.template))
    templatePath = args.template;

try
{
    let fileStat = fs.statSync(templatePath);
    if (!fileStat.isDirectory())
    {
        Logging.error('template: ' + args.template + ' not found');
        process.exit();
    }
}
catch(e)
{
    Logging.error('template: ' + args.template + ' not found');
    process.exit();
}


// ******************** find output ********************
let outputPath = kmakeRoot + '/' + args.output;
if(path.isAbsolute(args.output))
    outputPath = args.output;

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
Logging.info('loading build settings...');
try
{
    options = ymlLoader(args.project);
} catch (e)
{
    Logging.error(e);
    process.exit();
}


// ******************** build settings ********************
options.build =
{
    ...args,
    templatePath: FileHelper.normalize(templatePath),
    projectPath: FileHelper.normalize(kmakeRoot + '/' + args.project),
    outputPath: FileHelper.normalize(outputPath)
};

// ******************** get inputs ********************
Logging.info('getting input data...');
if ('inputs' in options)
{
    try
    {
        //save input cache
        let inputCachePath = args.project + '.input.cache';

        let inputCache = {};

        if (fs.existsSync(inputCachePath))
            inputCache = ymlLoader(inputCachePath);

        if (!args.useInputCache)
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

// ******************** apply command line data (defines) to all projects ********************
Logging.info('apply command line defines to each project...');

for(let optionKey in options)
{
    let project = options[optionKey];

    if ('type' in project && project.type == 'project')
    {
        if (!('defines' in project))
            project.defines = [];

        if (args.define)
            project.defines = [...project.defines, ...args.define];
    }
}

// ******************** process env variables ********************
Logging.info('replacing env variables...');
Helper.recursiveReplace(options, (key, object) =>
{
    if (typeof object === "string")
    {
        for(let varName in process.env)
        {
            varName = varName.toUpperCase();

            let replacement = '\\${ENV:' + varName + '}';
            let regex = new RegExp(replacement, 'g');
            object = object.replace(regex, process.env[varName]);
        }
    }

    return object;
});


// ******************** process local variables ********************
Logging.info('replacing local variables...');
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

// ******************** process global variables ********************
Logging.info('replacing global variables...');

for(let optionKey in options)
{
    let project = options[optionKey];

    let replacements = {};

    // ********** WORKING_DIR
    if ('workingDir' in project)
    {
        let workingDirAbsolute = path.resolve(project.workingDir);
        let outputDirAbsolute = path.resolve(options.build.outputPath);

        let relativePathToWorkingDir = FileHelper.relative(outputDirAbsolute, workingDirAbsolute);

        replacements['WORKING_DIR'] = relativePathToWorkingDir;
        replacements['WORKING_DIR_BACKSLASH'] = path.normalize(relativePathToWorkingDir);
    }

    // ********** WORKING_DIR_ABSOLUTE
    if ('workingDir' in project)
    {
        let workingDirAbsolute = FileHelper.normalize(path.resolve(project.workingDir));
        replacements['WORKING_DIR_ABSOLUTE'] = workingDirAbsolute;
        replacements['WORKING_DIR_ABSOLUTE_BACKSLASH'] = path.normalize(workingDirAbsolute);
    }

    // ********** PROJECT_NAME
    replacements['PROJECT_NAME'] = optionKey;

    //replace
    Helper.recursiveReplace(project, (key, object) =>
    {
        if (typeof object === "string")
        {
            for(let varName in replacements)
            {
                let replacement = '\\${' + varName + '}';
                let regex = new RegExp(replacement, 'g');
                object = object.replace(regex, replacements[varName]);
            }
        }

        return object;
    });
}

// ******************** apply workspace settings to each project ********************
Logging.info('processing workspace settings...');
for(let i in options.workspace.content)
{
    let project = options.workspace.content[i];

    for(let settingsKey in options.workspace.settings)
    {
        if (!(project in options))
            continue;

        if (!('settings' in options[project]))
            options[project].settings = {};

        //apply only if there is no project specific overwrite
        if (!(settingsKey in options[project].settings))
            options[project].settings[settingsKey] = options.workspace.settings[settingsKey];
    }
}


// ******************** add workspace dependencie paths to project's  ********************
Logging.info('appending workspace dependencies to includePaths and libPaths ...');
let depenencyItems = ['includePaths', 'libPaths'];

for(let optionKey in options)
{
    let project = options[optionKey];

    if ('dependencies' in project)
    {
        for(let dependencyKey in project.dependencies)
        {
            let dependency = project.dependencies[dependencyKey];

            if (dependency in options && 'workingDir' in options[dependency])
            {
                depenencyItems.forEach(depenencyItem =>
                {
                    if (!(depenencyItem in project))
                        project[depenencyItem] = [];

                    let relativePath = FileHelper.relative(project.workingDir, options[dependency].workingDir);

                    project[depenencyItem].push(relativePath);
                });
            }
        }
    }
}


// ******************** add additional defines to each project ********************
Logging.info('add additional defines to each project...');
Logging.info(' - PROJECT_NAME, PROJECT_[PROJECT_NAME], ASSET_DIR, PROJECT_PATH');

for(let optionKey in options)
{
    let project = options[optionKey];

    if ('type' in project && project.type == 'project')
    {
        if (!('defines' in project))
            project.defines = [];

        project.defines.push({'PROJECT_NAME': '"' + optionKey + '"'});

        project.defines.push('PROJECT_'+optionKey.toUpperCase());

        //this is the relative path based on the execution file
        project.defines.push({'ASSET_DIR': '"' + FileHelper.normalize(Globals.ASSET_DIRS_BY_TEMPLATE[args.template]) + '"'});

        //absolute path to project
        project.defines.push({'PROJECT_PATH': '"' + FileHelper.resolve(project.workingDir + '"')});
    }
}


// ******************** resolve platforms/architectures ********************
Logging.info('resolving platform specific settings...');
options = platformResolver(options, options.build);

// ******************** resolve source files ********************
Logging.info('resolving source files...');
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

            files = files.map(file => { return FileHelper.normalize(file); });
            sources = [...sources, ...files];
        }

        item.sources = sources;
    }
}


// ******************** resolve dependency files ********************

//this is basicly the same as the next part
//but for dependencies it could be that they are from the workspace -> so an extra check is needed
Logging.info('resolving dependency files...');
for(let itemKey in options)
{
    let item = options[itemKey];
    if ('dependencies' in item)
    {
        Helper.recursiveReplace(item.dependencies, (key, object) =>
        {
            if (typeof object === "string")
            {
                //only resolve paths for items not in workspace
                if (options.workspace.content.indexOf(object) == -1)
                {
                    let filePath = item.workingDir + '/' + object;
                    object = FileHelper.normalize(filePath);
                }
            }

            return object;
        });
    }
}


// ******************** resolve platform specific paths ********************
Logging.info('resolving platform/arch/config specific paths...');

let resolvingItems = ['includePaths', 'libPaths'];

for(let optionKey in options)
{
    let option = options[optionKey];

    for(let propKey in option)
    {
        let property = option[propKey];

        //only for resolvingItems items
        if (resolvingItems.indexOf(propKey) != -1)
        {
            Helper.recursiveReplace(property, (key, object) =>
            {
                if (typeof object === "string" && !path.isAbsolute(object))
                {
                    let filePath = option.workingDir + '/' + object;
                    object = FileHelper.normalize(filePath);
                }

                return object;
            });
        }
    }
}


// ******************** make ********************
(async () =>
{
    try
    {
        let res = null;

        if (args.build)
        {
            Logging.info('building project...');

            let res = await build(options);

            Logging.log('====================');

            if (res)
                Logging.rainbow("project built was successfully");
        }
        else if (args.export)
        {

        }
        else
        {
            Logging.info('generating project...');

            let res = await make(options);

            Logging.log('====================');

            if (res)
                Logging.rainbow("project generation was successful");
        }
    }
    catch (e)
    {
        Logging.error("make failed");
        Logging.log(e);
    }
})();
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const glob = require('glob');
const readlineSync = require('readline-sync');

const util = require('util');
const exec = util.promisify(require('child_process').exec);

const Helper = require('./helper/helper');
const FileHelper = require('./helper/fileHelper');
const Logging = require('./helper/logging');

const Globals = require('./globals');
const ymlLoader = require('./ymlLoader');
const platformResolver = require('./platformResolver');
const make = require('./make');

const kmakeRoot = fs.realpathSync(__dirname + '/..');

const HOOKS_SWAPPED = Helper.swapObjectKeyValue(Globals.HOOKS);

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
try { fileStat = fs.statSync(projectPath); }
catch(e) {}

if (!fileStat || !fileStat.isFile())
{
    projectPath += '/kmake.yml' ;

    fileStat = null;
    try { fileStat = fs.statSync(projectPath); }
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
Logging.info('loading build settings...');
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
Logging.info('getting input data...');
if ('inputs' in options)
{
    try
    {
        //save input cache
        let inputCachePath = projectPath + '.input.cache';

        let inputCache = {};

        if (fs.existsSync(inputCachePath))
            inputCache = ymlLoader(inputCachePath);

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
Logging.info('replacing variables...');
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
                //only resolve paths for items in worspace
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
                if (typeof object === "string")
                {
                    let filePath = option.workingDir + '/' + object;
                    object = FileHelper.normalize(filePath);
                }

                return object;
            });
        }
    }
}

// ******************** hooks ********************
async function runHooks(options, type)
{
    Logging.info('running ' + HOOKS_SWAPPED[type] + ' hooks...');

    for(let itemKey in options)
    {
        let item = options[itemKey];
        if ('hooks' in item)
        {
            let hooks = item['hooks'];

            for(let hookName in hooks)
            {
                let hook = hooks[hookName];

                if (hookName == HOOKS_SWAPPED[type])
                {
                    let command = hook;
                    let workingDir = path.resolve(item.workingDir);

                    try
                    {
                        const { stdout, stderr } = await exec(command, {cwd: workingDir});
                        Logging.log(stdout.trim());
                        if (stderr && stderr.trim())
                            Logging.error(stderr.trim());
                    }
                    catch(e)
                    {
                        Logging.error(itemKey + ': ' + HOOKS_SWAPPED[type] + ' hook failed');
                    }
                }
            }
        }
    }
}

//console.log(options);

// ******************** make ********************

(async () =>
{
    try
    {
        await runHooks(options, Globals.HOOKS.beforePrepare);

        Logging.info('generating project...');
        let res = await make(options);

        Logging.log('====================');

        if (res)
            Logging.rainbow("project generation was successful");

        await runHooks(options, Globals.HOOKS.afterPrepare);

    }
    catch (e)
    {
        Logging.error("make failed");
        Logging.log(e);
    }
})();
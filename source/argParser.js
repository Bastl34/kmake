const os = require('os');
const path = require('path');

const Globals = require('./globals');
const Logging = require('./helper/logging');
const Helper = require('./helper/helper');
const FileHelper = require('./helper/fileHelper');

function argParser()
{
    let args = process.argv.slice(2);

    let obj =
    {
        project: null,
        template: null,
        output: null
    };

    for(let argKey in Globals.ARG_OPTIONS_DEFAULT)
        obj[argKey] = Globals.ARG_OPTIONS_DEFAULT[argKey];

    let lastOptionKey = null;

    //find all options
    for(let i in args)
    {
        let arg = args[i];

        let isOptionKey = arg.indexOf('--') == 0;
        let optionKeyName = isOptionKey ? arg.substr(2) : null;

        //error check
        if (isOptionKey && !(optionKeyName in Globals.ARG_OPTIONS_DEFAULT))
        {
            Logging.warning('option key not found: ' + optionKeyName);
            optionKeyName = null;
            continue;
        }

        //the first 3 arguments without option are: projectPath, template, outputDir
        if (!lastOptionKey && !isOptionKey && (!obj.project || !obj.template || !obj.output))
        {
            if (obj.project === null)
                obj.project = arg;
            else if (obj.template === null)
                obj.template = arg;
            else if (obj.output === null)
                obj.output = arg;
        }
        else if (lastOptionKey && !isOptionKey)
        {
            let argItem = Globals.ARG_OPTIONS_DEFAULT[lastOptionKey];
            let type = typeof argItem;

            if (type == 'boolean')
            {
                arg = arg.toLocaleLowerCase();
                obj[lastOptionKey] = (arg == '1' || 'true');
            }
            else if (type == 'number')
            {
                obj[lastOptionKey] = parseFloat(arg);
            }
            else if (type == 'object' && argItem instanceof Array)
            {
                obj[lastOptionKey].push(arg);
            }
            else
                obj[lastOptionKey] = arg;
        }

        lastOptionKey = optionKeyName;
    }

    //use current dir as project dir if not set
    if (!obj.project)
        obj.project = './';

    //find template for the current platform (if not set)
    if (!obj.template)
    {
        if (os.platform() in Globals.DEFAULT_TEMPLATE_BY_PLATFORM)
            obj.template = Globals.DEFAULT_TEMPLATE_BY_PLATFORM[os.platform()];
    }

    //use default output dir if not set
    if (!obj.output)
        obj.output = path.join(obj.project, Globals.DEFAULT_OUTPUT_DIR);

    //check if something is missing
    if ((!obj.project || !obj.template || !obj.output))
    {
        Logging.info('kmake project.yml template outputdir');
        process.exit();
    }

    //appy defines
    applyDefines(obj);

    //apply path items
    applyPathItems(obj);

    return obj;
}

function applyDefines(obj)
{
    if ('define' in obj)
    {
        obj.define = obj.define.map(def =>
        {
            let splits = def.split('=');

            if (splits.length == 2)
            {
                let obj = {};
                let val = Helper.getValueOfStringContent(splits[1]);
                obj[splits[0]] = val;
                return obj;
            }

            return def;
        });
    }
}

function applyPathItems(obj)
{
    const pathItems = ['lib', 'includePath', 'libPath'];

    pathItems.forEach(pathItem =>
    {
        if (pathItem in obj)
        {
            obj[pathItem] = obj[pathItem].map(item =>
            {
                if (!path.isAbsolute(item) && FileHelper.countDirectoryLevels(item) > 1)
                    return path.resolve(item);
                return item;
            });
        }
    });
}

module.exports = argParser;
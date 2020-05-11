const os = require('os');
const path = require('path');
const fs = require('fs');

const Globals = require('./globals');
const Logging = require('./helper/logging');
const Helper = require('./helper/helper');
const FileHelper = require('./helper/fileHelper');

function argParser()
{
    let args = process.argv.slice(2);

    //repacing short params and synonyms with full one
    for(let i=0; i<args.length; ++i)
    {
        let arg = args[i];

        let isShortArg = arg.indexOf('-') == 0;
        let isLongArg = arg.indexOf('--') == 0;

        let argName = arg.substr(1);
        if (isLongArg)
            argName = arg.substr(2);

        if (argName in Globals.ARG_OPTIONS_SYNONYMS)
            args[i] = '--' + Globals.ARG_OPTIONS_SYNONYMS[argName];

        //gcc style args (-DMYDEF=1 --> --define MYDEF=1)
        if (isShortArg && !isLongArg)
        {
            let shortArg = null;

            for(let argKey in Globals.ARG_OPTIONS_SYNONYMS)
            {
                if (argName.indexOf(argKey) === 0 && argName != argKey)
                {
                    shortArg = argKey;
                    break;
                }
            }

            if (shortArg)
            {
                let key = '--' + Globals.ARG_OPTIONS_SYNONYMS[shortArg];
                let value = argName.substr(shortArg.length);

                args[i] = key;
                args.splice(i + 1, 0, value);
                ++i;
            }
        }
    }

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
    for(let i=0; i<args.length; ++i)
    {
        let arg = args[i];

        let isOptionKey = arg.indexOf('--') == 0;
        let isLastOption = i + 1 == args.length
        let isNextOptionKey = !isLastOption && args[i + 1].indexOf('--') == 0;
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
                obj[lastOptionKey] = (arg == '1' || arg == 'true');
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
        else if (isOptionKey && (isNextOptionKey || isLastOption))
            obj[optionKeyName] = true;

        lastOptionKey = optionKeyName;
    }

    //use current dir as project dir if not set
    if (!obj.project)
        obj.project = './';

    if (fs.existsSync(obj.project) && fs.lstatSync(obj.project).isFile())
        obj.projectDir = path.dirname(obj.project);
    else
        obj.projectDir = obj.project;

    //find template for the current platform (if not set)
    if (!obj.template)
    {
        if (os.platform() in Globals.DEFAULT_TEMPLATE_BY_PLATFORM)
            obj.template = Globals.DEFAULT_TEMPLATE_BY_PLATFORM[os.platform()];
    }

    //use default output dir if not set
    if (!obj.output)
        obj.output = path.resolve(path.join(obj.projectDir, Globals.DEFAULT_OUTPUT_DIR));

    //check if something is missing
    if ((!obj.project || !obj.template || !obj.output))
    {
        Logging.info('kmake project.yml template outputdir');
        process.exit();
    }

    //resolve requirements
    resolveRequirements(obj);

    //appy defines
    applyDefines(obj);

    //apply path items
    applyPathItems(obj);

    return obj;
}

function resolveRequirements(obj)
{
    //requrements example: run needs make and build

    let objCopy = {...obj};

    for(let argKey in Globals.ARG_OPTIONS_REQUREMENTS)
    {
        if (argKey in objCopy && objCopy[argKey] == true)
        {
            let isArray = Globals.ARG_OPTIONS_REQUREMENTS[argKey] instanceof Array;

            for(let itemKey in Globals.ARG_OPTIONS_REQUREMENTS[argKey])
            {
                let item = Globals.ARG_OPTIONS_REQUREMENTS[argKey][itemKey];

                if (isArray)
                    obj[item] = true;
                else
                    obj[itemKey] = item;
            }
        }
    }
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
const micromatch = require('micromatch');

const Globals = require('./globals');

const platformKeys = Object.keys(Globals.PLATFORMS);

function platformResolver(options, buildOptions, level = 0)
{
    let isArray = options instanceof Array;
    let newOptions = isArray ? [] : {};

    for(let optionKey in options)
    {
        let option = options[optionKey];

        let newOption = undefined;

        //resolve on level 1
        if (level == 1)
        {
            let hasResolvableKey = Globals.PLATFORM_RESOLVER.indexOf(optionKey) != -1;

            if (hasResolvableKey)
                newOption = resolvePlatform(option, buildOptions);
            else
                newOption = options[optionKey];
        }
        //recursive
        else
        {
            if (option instanceof Object)
                newOption = platformResolver(option, buildOptions, level + 1);
            else
                newOption = options[optionKey];
        }

        //add to array
        if (newOption)
        {
            if (isArray)
                newOptions.push(newOption);
            else
                newOptions[optionKey] = newOption;
        }
    }

    return newOptions;
}

function resolvePlatform(options, build)
{
    let newContent = [];

    for(let optionKey in options)
    {
        let option = options[optionKey];

        //check if option is an object -> otherwise add it directly
        if (!(option instanceof Object))
        {
            newContent.push(option);
            continue;
        }

        let platformItemFound = false;
        let keys = Object.keys(option);
        for(let i = 0;i < keys.length;++i)
        {
            let keyName = keys[i];

            if (typeof keyName === 'string' && keyName.indexOf('platform:') == 0)
            {
                let platform = keyName.substr('platform:'.length);
                let match = micromatch(platformKeys, platform);

                if (match && match instanceof Array)
                    match = match[0];

                //remove not matching platforms
                if (match == build.template)
                    newContent.push(option[keyName]);

                platformItemFound = true;
            }
        }

        if (!platformItemFound)
            newContent.push(option);
    }

    newContent = resolveArchitecture(newContent, build);
    newContent = resolveGenerics(newContent);

    return newContent;
}

function resolveArchitecture(options, build)
{
    let newContent = {generic: []};
    Globals.PLATFORMS[build.template].forEach(arch => { newContent[arch] = []; });

    for(let optionKey in options)
    {
        let option = options[optionKey];

        //check if option is an object -> otherwise add it directly to gerneic
        if (!(option instanceof Object))
        {
            newContent.generic.push(option);
            continue;
        }

        let archItemFound = false;
        let keys = Object.keys(option);
        for(let i = 0;i < keys.length;++i)
        {
            let keyName = keys[i];

            if (typeof keyName === 'string' && keyName.indexOf('arch:') == 0)
            {
                let arch = keyName.substr('arch:'.length);

                if (Object.keys(newContent).indexOf(arch) != -1)
                    newContent[arch].push(option[keyName]);

                archItemFound = true;
            }
        }

        if (!archItemFound)
            newContent.generic.push(option);
    }

    for(let arch in newContent)
    {
        if (arch != 'generic')
            newContent[arch] = resolveConfiguration(newContent[arch]);
    }

    return newContent;
}

function resolveConfiguration(options)
{
    let newContent = {generic: []};
    Globals.CONFIGURATIONS.forEach(config => { newContent[config] = []; });

    //resolve all
    for(let optionKey in options)
    {
        let option = options[optionKey];

        //check if option is an object -> otherwise add it directly to gerneric
        if (!(option instanceof Object))
        {
            newContent.generic.push(option);
            continue;
        }

        let configItemFound = false;
        let keys = Object.keys(option);
        for(let i = 0;i < keys.length;++i)
        {
            let keyName = keys[i];

            if (typeof keyName === 'string' && keyName.indexOf('config:') == 0)
            {
                let config = keyName.substr('config:'.length);

                if (Object.keys(newContent).indexOf(config) != -1)
                    newContent[config] = [...newContent[config], ...option[keyName]];

                configItemFound = true;
            }
        }

        if (!configItemFound)
            newContent.generic.push(option);
    }

    return newContent;
}

function resolveGenerics(archs)
{
    for(let archKey in archs)
    {
        let archObj = archs[archKey];

        if (archKey != 'generic')
        {
            for(let configKey in archObj)
            {
                let configObj = archObj[configKey];

                if (configKey != 'generic')
                {
                    let archGenerics = archs.generic;
                    let configGenerics = archObj.generic;

                    archObj[configKey] = [...archGenerics, ...configGenerics, ...configObj];
                }
            }

            delete archObj.generic;
        }
    }

    delete archs.generic;

    return archs;
}

module.exports = platformResolver;
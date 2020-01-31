const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const micromatch = require('micromatch');

const Globals = require('./globals');
const FileHelper = require('./helper/fileHelper');

const platformKeys = Object.keys(Globals.PLATFORMS);

function platformResolver(options)
{

    /*
        x86_64
        {
            generic: ...,
            release: ...,
            debug: ...
        }
        ...
    */
    console.log(options);

    //console.log(options.app.includes);

    let isArray = (options instanceof Array);
    let newOptions = isArray ? [] : {};

    for(let optionKey in options)
    {
        let option = options[optionKey];

        let newOption = undefined;

        if (typeof optionKey === 'string' && optionKey.indexOf('platform:') == 0)
        {
            let platform = optionKey.substr('platform:'.length)
            let match = micromatch(platformKeys, platform);

            //remove not matching platforms
            if (match == options.platform)
            {

            }

            //apply platform data
            //options[optionKey] =
        }

        if (option instanceof Object)
            newOption = platformResolver(option);
        else
            newOption = options[optionKey]

        if (isArray)
            newOptions.push(newOption)
        else
            newOptions[optionKey] = newOption;

    }

    return newOptions;
}

/*
function resolveArchitecture()
{

}

function resolveConfiguration()
{

}
*/

module.exports = platformResolver;
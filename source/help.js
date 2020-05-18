const colors = require('colors');

const Globals = require('./globals');

function help()
{
    console.log('usage: kmake PROJECT_DIR [OPTIONS]');

    console.log();
    console.log('options:');
    for(let argKey in Globals.ARG_OPTIONS_DEFAULT)
    {
        // synonyms
        const argSyns = [];
        for(let argSynKey in Globals.ARG_OPTIONS_SYNONYMS)
        {
            if (Globals.ARG_OPTIONS_SYNONYMS[argSynKey] == argKey)
                argSyns.push(argSynKey);
        }

        // requirements
        const requrements = {};
        for(let argReqKey in Globals.ARG_OPTIONS_REQUREMENTS)
        {
            if (argReqKey == argKey)
            {
                const items = Globals.ARG_OPTIONS_REQUREMENTS[argReqKey];
                const isArray = items instanceof Array;

                for(let itemKey in items)
                {
                    if (isArray)
                    {
                        items.forEach(item => { requrements[item] = true; });
                    }
                    else
                    {
                        for(let key in items)
                            requrements[key] = items[key];
                    }
                }

                break;
            }
        }

        //possible values
        const possibilities = [];
        for(let argPossKey in Globals.ARG_POSSIBILITIES)
        {
            if (argPossKey == argKey)
            {
                let content = Globals[Globals.ARG_POSSIBILITIES[argPossKey]];

                if (content instanceof Object)
                {
                    for(let itemKey in content)
                    {
                        //console.log(content[itemKey])
                        if (content[itemKey] instanceof Object)
                            possibilities.push(itemKey + ' --> ' + [...content[itemKey]].join(', '));
                        else
                            possibilities.push(itemKey + ' --> ' + content[itemKey]);
                    }
                }
                else
                    possibilities.push(content);
            }
        }

        // ********** name and desc **********
        console.log(colors.bold(` --${argKey} (-${argSyns.join(', -')}):`));
        console.log(`   ${Globals.ARG_DESC[argKey]}`);

        // ********** default value/s **********
        const defaultVal = Globals.ARG_OPTIONS_DEFAULT[argKey];
        if
        (
            defaultVal
            &&
            (
                !(defaultVal instanceof Array)
                ||
                (
                    defaultVal instanceof Object
                    &&
                    defaultVal.length > 0
                )
            )
        )
        {
            console.log(`   default value: ` + colors.bold(`${defaultVal}`));
        }

        // ********** possible value/s **********
        if (possibilities.length > 0)
        {
            console.log(`   ` + colors.italic(`possible values:`));
            for(let key in possibilities)
                console.log(`      ${possibilities[key]}`);
        }

        // ********** multi values **********
        if (Globals.ARG_OPTIONS_DEFAULT[argKey] instanceof Array)
            console.log(`   multiple values are possible`);

        // ********** requrements **********
        if (Object.keys(requrements).length > 0)
        {
            console.log(`   ` + colors.italic(`this flag will set:`));
            for(let key in requrements)
                console.log(`      ${key}: ${requrements[key]}`);
        }
        console.log(``);
    }

    process.exit(0);
}

module.exports = help;
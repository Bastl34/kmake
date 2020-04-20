const colors = require('colors');
let Logging =
{
    setVerbose(verbose)
    {
        global.loggingVerbose = verbose;
    },

    isVerbose()
    {
        return !!global.loggingVerbose;
    },

    log(...args)
    {
        if (global.loggingVerbose)
            console.log(...args);
    },

    info(...args)
    {
        if (global.loggingVerbose)
            console.log(colors.cyan(...args));
    },

    notice(...args)
    {
        if (global.loggingVerbose)
            console.log(colors.cyan(...args));
    },

    success(...args)
    {
        if (global.loggingVerbose)
            console.log(colors.green(...args));
    },

    error(...args)
    {
        console.log(colors.red(...args));
    },

    warning(...args)
    {
        if (global.loggingVerbose)
            console.log(colors.yellow(...args));
    },

    rainbow(...args)
    {
        if (global.loggingVerbose)
            console.log(colors.rainbow(...args));
    },

    //ignore verbose flag
    out(...args)
    {
        console.log(...args);
    }
};


module.exports = Logging;
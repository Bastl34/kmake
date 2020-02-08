const colors = require('colors');

let Logging =
{
    log(...args)
    {
        console.log(...args);
    },

    info(...args)
    {
        console.log(colors.cyan(...args));
    },

    notice(...args)
    {
        console.log(colors.cyan(...args));
    },

    success(...args)
    {
        console.log(colors.green(...args));
    },

    error(...args)
    {
        console.log(colors.red(...args));
    },

    warning(...args)
    {
        console.log(colors.yellow(...args));
    },

    rainbow(...args)
    {
        console.log(colors.rainbow(...args));
    }
}


module.exports = Logging;
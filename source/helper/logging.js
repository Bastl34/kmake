const colors = require('colors');

let Logging =
{
    log: function(...args)
    {
        console.log(...args);
    },

    info: function(...args)
    {
        console.log(...args);
    },

    notice: function(...args)
    {
        console.log(colors.cyan(...args));
    },

    success: function(...args)
    {
        console.log(colors.green(...args));
    },

    error: function(...args)
    {
        console.log(colors.red(...args));
    },

    warning: function(...args)
    {
        console.log(colors.yellow(...args));
    },

    rainbow: function(...args)
    {
        console.log(colors.rainbow(...args));
    },
}


module.exports = Logging;
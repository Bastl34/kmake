let Helper =
{
    recursiveReplace: function (o, fn)
    {
        for (var i in o)
        {
            //call function
            let res = fn.apply(this, [i, o[i]]);

            //apply replacement if needed
            if (res != undefined)
                o[i] = res;

            //recursive only for objects
            if (o[i] !== null && typeof (o[i]) === 'object')
                Helper.recursiveReplace(o[i], fn);
        }
    }
}


module.exports = Helper;
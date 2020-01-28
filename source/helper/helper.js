let _RANDOM_STR_MAP = {};
const _RANDOM_STR_MAX_TRIES = 10;

let Helper =
{
    recursiveReplace: function (o, fn)
    {
        for (let i in o)
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
    },

    randomString: function(length, characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', allowSame = true)
    {
        let charactersLength = characters.length;

        let tries = 0;
        do
        {
            let result = '';
            for(let i = 0; i < length; ++i)
                result += characters.charAt(Math.floor(Math.random() * charactersLength));

            if (allowSame)
                return result;

            if (!(result in _RANDOM_STR_MAP))
            {
                _RANDOM_STR_MAP[result] = true;
                return result;
            }

            ++tries
        }
        while (tries < _RANDOM_STR_MAX_TRIES)

        throw "randomString max tries reached";
        return null;
     }
}


module.exports = Helper;
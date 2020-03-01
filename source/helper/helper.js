let _RANDOM_STR_MAP = {};
const _RANDOM_STR_MAX_RETRIES = 10;

let Helper =
{
    recursiveReplace(o, fn)
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

    randomString(length, characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', allowSame = true)
    {
        let charactersLength = characters.length;

        let retries = 0;
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

            ++retries;
        }
        while (retries < _RANDOM_STR_MAX_RETRIES);

        throw Error("randomString max retries reached");
    },

    swapObjectKeyValue(keys)
    {
        let newKeys = {};

        for(let key in keys)
            newKeys[keys[key]] = key;

        return newKeys;
    },

    capitalizeFirstLetter(string)
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    sleep(milliseconds)
    {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    },

    hasKeys(obj, level,  ...rest)
    {
        if (obj === undefined)
            return false;

        if (rest.length == 0 && obj.hasOwnProperty(level))
            return true;

        return Helper.hasKeys(obj[level], ...rest);
    },

    getValueOfStringContent(value)
    {
        //bool
        if (value == 'true')
            return true;
        else if (value == 'false')
            return false;
        //float
        else if (!isNaN(value) && !isNaN(parseFloat(value, 10)) && value.toString().indexOf('.') != -1)
            return parseFloat(value, 10);
        //int
        else if (!isNaN(value) && !isNaN(parseInt(value, 10)))
            return parseInt(value, 10);

        //other (string)
        return value;
    }
};


module.exports = Helper;
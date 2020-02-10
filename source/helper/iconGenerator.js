const Jimp = require('jimp');

async function iconGenerator(fromPath, toPath, res)
{
    let icon = await Jimp.read(fromPath);

    //remove alpha channel
    //icon.rgba(false);

    await icon.resize(res, res).write(toPath);
}

module.exports = iconGenerator;
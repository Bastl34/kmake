const fs = require('fs');
const path = require('path');

let Helper =
{
    getAllFiles: function(dir, fileList = [])
    {
        const files = fs.readdirSync(dir);

        files.forEach((file) =>
        {
            const filePath = path.join(dir, file);
            const fileStat = fs.lstatSync(filePath);

            if (fileStat.isDirectory())
                findInDir(filePath, fileList);
            else
                fileList.push(filePath)
        });

        return fileList;
    }

}


module.exports = Helper;
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
    },

    countDirectoryLevels(itemPath)
    {
        if (!itemPath)
            return 0;

        //return itemPath.split("/").length - 1;
        return itemPath.split("/").length;
    },

    isSubdirectory: function(outerDirPath, subDirPath)
    {
        outerDirPath = outerDirPath.replace(/\\/g,'/');
        subDirPath = subDirPath.replace(/\\/g,'/');

        //if the paths are the same or the sub dir path is smaller -> it's not a subdir
        if (outerDirPath == subDirPath || subDirPath.length < outerDirPath.length)
            return false;

        let outerDirLevels = Helper.countDirectoryLevels(outerDirPath);
        let subDirLevels = Helper.countDirectoryLevels(subDirPath);

        if (subDirPath.indexOf(outerDirPath) == 0 && subDirLevels == outerDirLevels+1)
            return true;

        return false;
    },

    getAllParentDirectoryPaths: function(dir, includeSelf = false)
    {
        let parentDirectoryPaths = [];

        do
        {
            dir = path.dirname(dir);

            if (dir != '.')
                parentDirectoryPaths.push(dir);
        }
        while(dir != '.')

        return parentDirectoryPaths;
    },

    normalize(item)
    {
        return path.normalize(item).replace(/\\/g,'/');
    },

    resolve(item)
    {
        return path.resolve(item).replace(/\\/g,'/');
    },

    relative(from, to)
    {
        return path.relative(from, to).replace(/\\/g,'/');
    }

}


module.exports = Helper;
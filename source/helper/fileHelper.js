const fs = require('fs');
const path = require('path');

let FileHelper =
{
    getAllFiles(dir, fileList = [])
    {
        const files = fs.readdirSync(dir);

        files.forEach(file =>
        {
            const filePath = path.join(dir, file);
            const fileStat = fs.lstatSync(filePath);

            if (fileStat.isDirectory())
                FileHelper.getAllFiles(filePath, fileList);
            else
                fileList.push(filePath);
        });

        return fileList;
    },

    countDirectoryLevels(itemPath)
    {
        if (!itemPath)
            return 0;

        return itemPath.split("/").length;
    },

    isSubdirectory(outerDirPath, subDirPath)
    {
        outerDirPath = outerDirPath.replace(/\\/g, '/');
        subDirPath = subDirPath.replace(/\\/g, '/');

        // if the paths are the same or the sub dir path is smaller -> it's not a subdir
        if (outerDirPath == subDirPath || subDirPath.length < outerDirPath.length)
            return false;

        let outerDirLevels = FileHelper.countDirectoryLevels(outerDirPath);
        let subDirLevels = FileHelper.countDirectoryLevels(subDirPath);

        if (subDirPath.indexOf(outerDirPath) == 0 && subDirLevels == outerDirLevels + 1)
            return true;

        return false;
    },

    getAllParentDirectoryPaths(dir)
    {
        let parentDirectoryPaths = [];

        do
        {
            dir = path.dirname(dir);

            if (dir != '.')
                parentDirectoryPaths.push(dir);
        }
        while(dir != '.');

        return parentDirectoryPaths;
    },

    isDir(path)
    {
        const fileStat = fs.statSync(path);
        return fileStat.isDirectory();
    },

    normalize(item)
    {
        return path.normalize(item).replace(/\\/g, '/');
    },

    resolve(item)
    {
        return path.resolve(item).replace(/\\/g, '/');
    },

    join(...items)
    {
        return path.join(...items).replace(/\\/g, '/');
    },

    relative(from, to)
    {
        return path.relative(from, to).replace(/\\/g, '/');
    },

    unixPath(input)
    {
        return input.replace(/\\/g, '/');
    },

    winPath(input)
    {
        return input.replace(/\//g, '\\');
    },

    removeTrailingSlash(input)
    {
        if(input.substr(-1) === '/' || input.substr(-1) === '\\')
            return input.substr(0, input.length - 1);
        
        return input;
    }
};


module.exports = FileHelper;
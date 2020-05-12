const os = require('os');
const path = require('path');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const archiver = require('archiver');
const copy = require('recursive-copy');

const Logging = require('./helper/logging');
const MakeHelper = require('./helper/makeHelper');
const Globals = require('./globals');

async function exp(options)
{
    let paths = [];
    if (options.build.template == 'xcodeMac')
        paths = await getXcodeMacPaths(options);
    else if (options.build.template == 'vs2019')
        paths = await getVisualStudioPaths(options);
    else if (options.build.template == 'makefile')
        paths = await getMakefilePaths(options);

    let exportDest = options.build.exportDest;
    if (!exportDest)
        exportDest = path.join(options.build.outputPath, Globals.DEFAULT_EXPORT_DIR);

    let exportDestExt = path.extname(exportDest);

    if (exportDestExt == '.zip')
        return await compress(paths, exportDest, 'zip');
    else if (exportDestExt == '.tar')
        return await compress(paths, exportDest, 'tar');
    else if (path.basename(exportDest).indexOf('.tar.gz') != -1)
        return await compress(paths, exportDest, 'tar', { store: true, gzip: true });
    else if (exportDestExt == '.dmg')
        return await createDmg(options, paths, exportDest);
    else
        return await copyItems(paths, exportDest);
}

async function copyItems(paths, exportDest)
{
    for(let i in paths)
        await copy(paths[i].absolute, path.join(exportDest, paths[i].relative), {overwrite: true});

    return true;
}

async function compress(paths, exportDest, format, options)
{
    return new Promise((resolve, reject) =>
    {
        options = {...{zlib: { level: 9 }}, ...options};

        let output = fs.createWriteStream(exportDest);
        let archive = archiver(format, options);

        output.on('close', () => { resolve(true); });
        output.on('end', () => { resolve(true); });

        archive.on('warning', (err) =>
        {
            if (err.code === 'ENOENT')
                Logging.warning(err);
            else
                reject(err);
        });
        archive.on('error', (err) => { reject(err); });

        archive.pipe(output);

        paths.forEach(element =>
        {
            archive.directory(element.absolute, element.relative);
        });

        archive.finalize();
    });
}

async function createDmg(options, paths, exportDest)
{
    if (os.platform() != 'darwin')
        throw Error('dmg creation is only supported on macOS');

    let defaultExportDir = path.resolve(path.join(options.build.outputPath, Globals.DEFAULT_EXPORT_DIR));
    let name = options.workspace.name;

    await copyItems(paths, defaultExportDir);
    await exec(`hdiutil create -volname ${name} -srcfolder ${defaultExportDir} -ov -format UDZO ${exportDest}`);

    return true;
}

async function getVisualStudioPaths(options)
{
    let paths = [];

    const outDir = path.join(options.build.outputPath);

    //assets
    let assetDir = path.join(outDir, Globals.DEFAULT_ASSET_DIR);
    if (fs.existsSync(path.resolve(assetDir)))
        paths.push({relative: Globals.DEFAULT_ASSET_DIR, absolute: path.resolve(assetDir)});

    //bins
    for(let i in options.build.arch)
    {
        let arch = options.build.arch[i];
        let binDir = path.join(outDir, arch);

        if (!fs.existsSync(binDir))
            continue;

        let dirAbssolute = path.resolve(binDir);
        let tempDir = path.resolve(path.join(outDir, Globals.DEFAULT_TEMP_DIR, arch));

        //copy to a temp dir first to filter out unneeded files
        await copy(dirAbssolute, tempDir, {overwrite: true, dot: false, filter: ['**/*.dll', '**/*.exe']});

        paths.push({relative: arch, absolute: tempDir});
    }

    return paths;
}

async function getMakefilePaths(options)
{
    let paths = [];

    const outDir = path.join(options.build.outputPath);

    //assets
    let assetDir = path.join(outDir, Globals.DEFAULT_ASSET_DIR);
    if (fs.existsSync(path.resolve(assetDir)))
        paths.push({relative: Globals.DEFAULT_ASSET_DIR, absolute: path.resolve(assetDir)});

    //bins
    let binDir = path.join(outDir, Globals.DEFAULT_BIN_DIR);
    paths.push({relative: path.basename(Globals.DEFAULT_BIN_DIR), absolute: path.resolve(binDir)});

    return paths;
}

async function getXcodeMacPaths(options)
{
    let paths = [];

    const mainProjectName = MakeHelper.findBuildProject(options);
    const configName = options.build.release ? 'Release' : 'Debug';

    const outDir = path.join(options.build.outputPath, options.build.binOutputDir);

    if (options[mainProjectName].outputType == 'app')
    {
        let app = path.join(outDir, 'Build/Products', configName, mainProjectName + '.app');
        paths.push({relative: path.basename(app), absolute: path.resolve(app)});
    }
    else if (options[mainProjectName].outputType == 'framework')
    {
        let app = path.join(outDir, 'Build/Products', configName, mainProjectName + '.framework');
        paths.push({relative: path.basename(app), absolute: path.resolve(app)});
    }
    else
    {
        let dir = path.join(outDir, 'Build/Products', configName);
        paths.push({relative: '.', absolute: path.resolve(dir)});
    }

    return paths;
}

module.exports = exp;
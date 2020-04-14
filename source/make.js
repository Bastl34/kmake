const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const yaml = require('js-yaml');
const dmg = require('dmg');
const copy = require('recursive-copy');

const dmgMount = util.promisify(dmg.mount);
const dmgUnmount = util.promisify(dmg.unmount);
const mkdirProm = util.promisify(fs.mkdir);
const rmdirProm = util.promisify(fs.rmdir);

const decompress = require('decompress');

const Globals = require('./globals');
const Logging = require('./helper/logging');
const Helper = require('./helper/helper');
const NetHelper = require('./helper/netHelper');

const makeXcode = require('./projectMaker/xcode');
const makeVisualStudio = require('./projectMaker/visualStudio');
const makeMakefile = require('./projectMaker/makefile');

async function make(options)
{
    //some error checks
    let workspace = options.workspace || null;
    if (!workspace || !('content' in workspace) || !(workspace.content instanceof Array) || workspace.content.length == 0)
    {
        Logging.error('workspace not found or empty');
        return false;
    }

    //run validate
    if (!validate(options))
    {
        Logging.error('validation failed');
        return false;
    }

    await createOutputDir(options);
    await download(options);

    let res = false;

    //create project files
    if (options.build.template == 'xcodeMac')
        res = await makeXcode(options);
    else if (options.build.template == 'vs2019')
        res = await makeVisualStudio(options);
    else if (options.build.template == 'makefile')
        res = await makeMakefile(options);

    return res;
}

async function createOutputDir(options)
{
    //clear output dir if needed
    if (options.build.cleanOutputDir && fs.existsSync(path.normalize(options.build.outputPath)))
    {
        Logging.info('clearing output dir...');
        await fs.promises.rmdir(path.normalize(options.build.outputPath), {recursive: true});

        //wait some tome -> otherwise mkdir will fail on windows
        await Helper.sleep(100);
    }

    //create output directory
    if (!fs.existsSync(path.normalize(options.build.outputPath)))
    {
        Logging.info('creating output dir...');
        await fs.promises.mkdir(path.normalize(options.build.outputPath));
    }
}

async function download(options)
{
    let downloadList = {}

    // check projects and goup
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        if ('downloads' in options[projectName])
        {
            for (let archKey in options[projectName].downloads)
            {
                for (let config in options[projectName].downloads[archKey])
                {
                    for (let i in options[projectName].downloads[archKey][config])
                    {
                        let dl = options[projectName].downloads[archKey][config][i];
                        dl.workingDir = options[projectName].workingDir;

                        let dlKey = Helper.sha265(JSON.stringify(dl));
                        downloadList[dlKey] = dl;
                    }
                }
            }
        }
    }

    //save download cache
    let cachePath = path.join(options.build.projectDir, Globals.CACHE_FILES.DOWNLOAD);
    let cache = {};

    if (fs.existsSync(cachePath) && options.build.useDownloadCache)
        cache = yaml.safeLoad(fs.readFileSync(cachePath, 'utf8'));

    for (let i in downloadList)
    {
        let dl = downloadList[i];

        if (options.build.useDownloadCache && cache[i])
            continue;

        let size = await NetHelper.getDownloadSize(dl.url);

        Logging.info('downloading: ' + dl.url + ' (' + Helper.bytesToSize(size) +  ') ...');

        await mkdirProm(path.dirname(dl.dest), {recursive: true});
        await NetHelper.download(dl.url, dl.dest);

        if (dl.extractTo)
        {
            Logging.info('extracting to: ' + dl.extractTo + ' ...');

            let files = await extract(dl.dest, dl.extractTo);
            Logging.info(files.length + ' extracted');
        }

        if (dl.postCmd)
        {
            let {stdout, stderr} = await exec(dl.postCmd, {cwd: dl.workingDir});

            if (stdout && stdout.trim())
                console.log(stdout);

            if (stderr && stderr.trim())
                console.log(stderr);
        }

        cache[i] = true;
    }

    //save cache
    let dump = yaml.safeDump(cache);
    fs.writeFileSync(cachePath, dump);
}

async function extract(file, extractTo)
{
    let files = 0;

    let ext = path.extname(file);

    if (ext == '.dmg')
    {
        if (os.platform() != 'darwin')
            throw Error('dmg extracting is not supported on your platform');

        let volume = await dmgMount(file);
        files = await copy(volume, extractTo, {overwrite: true});
        await dmgUnmount(volume);
    }
    else
        files = await decompress(file, extractTo);

    return files
}

function validate(options)
{
    // check projects
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        if (!(projectName in options))
        {
            Logging.error('project ' + projectName + ' not found');
            return false;
        }
    }

    return true;
}

module.exports = make;
const path = require('path');
const fs = require('fs');

const copy = require('recursive-copy');
const replace = require('replace-in-file');

const Helper = require('../helper/helper');
const FileHelper = require('../helper/fileHelper');
const Logging = require('../helper/logging');
const iconGenerator = require('../helper/iconGenerator');

const Globals = require('../globals');

const OUTPUT_TYPE_MAP =
{
    'app': 'main',
    'framework': 'dynamic'
};

const FILE_ENDING_BY_OUTPUT_TYPE =
{
    'main': '.exe',
    'static': '.obj',
    'dynamic': '.dll'
};

function uuid()
{
    let a = Helper.randomString(8, '0123456789ABCDEF', false);
    let b = Helper.randomString(4, '0123456789ABCDEF', false);
    let c = Helper.randomString(4, '0123456789ABCDEF', false);
    let d = Helper.randomString(4, '0123456789ABCDEF', false);
    let e = Helper.randomString(12, '0123456789ABCDEF', false);

    return `${a}-${b}-${c}-${d}-${e}`;
}

async function makeVisualStudio(options)
{
    const vsVersion = 'vs2019';

    // ******************** copy projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        let outputType = project.outputType;
        if (outputType in OUTPUT_TYPE_MAP)
            outputType = OUTPUT_TYPE_MAP[outputType];

        let sourcePath = path.join(options.build.templatePath, outputType);
        let destPath = path.join(options.build.outputPath, projectName);

        let results = await copy(sourcePath, destPath, {overwrite: true});
        Logging.log(results.length + ' files copied');

        //rename project files
        fs.renameSync(path.join(destPath,outputType+'.vcxproj'), path.join(destPath,projectName+'.vcxproj'));
        fs.renameSync(path.join(destPath,outputType+'.vcxproj.filters'), path.join(destPath,projectName+'.vcxproj.filters'));
        fs.renameSync(path.join(destPath,outputType+'.vcxproj.user'), path.join(destPath,projectName+'.vcxproj.user'));
    }

    // ******************** generate .xcworkspace ********************
    let sourcePath = options.build.templatePath + '/workspace.sln';
    let destPath = options.build.outputPath + '/' + options.workspace.name + '.sln';

    let results = await copy(sourcePath, destPath, {overwrite: true});
    Logging.log(results.length + ' files copied');

    let solutionId1 = uuid();
    let solutionId2 = uuid();

    let projectDef = '';
    let platformDef = '';

    let projectIds = {}

    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];

        let projectId = uuid();
        projectIds[projectName] = projectId;

        projectDef += `Project("{${solutionId1}}") = "${projectName}", ".\\${projectName}\\${projectName}.vcxproj", "{${projectId}"\nEndProject\n`;

        Globals.PLATFORMS[vsVersion].forEach(platform =>
        {
            Globals.CONFIGURATIONS.forEach(config =>
            {
                let configName = Helper.capitalizeFirstLetter(config);
                platformDef += `		{${projectId}}.${configName}|${platform}.ActiveCfg = ${configName}|${platform}\n`;
            });
        });
    }

    results = await replace({files: destPath, from: '#PROJECT_DEF#', to: projectDef.trim()});
    results = await replace({files: destPath, from: '#PLATFORM_DEF#', to: platformDef.trim()});
    results = await replace({files: destPath, from: '#SOLUTION_ID#', to: solutionId2});
    Logging.log(results.length + ' files changed');


    // ******************** generate projects ********************
    for(let i in options.workspace.content)
    {
        let projectName = options.workspace.content[i];
        let project = options[projectName];

        if (project.type != 'project' && project.projectType != 'source')
            continue;

        Logging.info('========== ' + projectName + ' ==========');

        let libsList = [];
        let soucesList = [];
        let directoryList = {};

        // ********** replacements
        let projectFilePath = options.build.outputPath + '/' + projectName + '/' + projectName + '.vcxproj';

        results = await replace({files: projectFilePath, from: /#PROJECT_ID#/g, to: projectIds[projectName]});

        // ********** platform specific data
        Logging.log("applying platform data...");
        await applyPlatformData(projectName, project, options);
    }
    return true;
}

async function applyPlatformData(projectName, project, options)
{
    let projectFilePath = options.build.outputPath + '/' + projectName + '/' + projectName + '.vcxproj';

    //Globals.PLATFORMS[options.build.template].forEach(platform =>
    for(let platformI in Globals.PLATFORMS[options.build.template])
    {
        let platform = Globals.PLATFORMS[options.build.template][platformI];

        //Globals.CONFIGURATIONS.forEach(config =>
        for(let configI in Globals.CONFIGURATIONS)
        {
            let config = Globals.CONFIGURATIONS[configI];
            let configKey = config.toUpperCase();

            //include
            let includePathsContent = '';
            let includesArray = ('includePaths' in project) ? project['includePaths'][platform][config] : [];
            includesArray.forEach(item =>
            {
                item = FileHelper.relative(options.build.outputPath, item);
                includePathsContent += '"' + item + '";';
            });

            /*

            //defines
            let definesContent = '';
            let definesArray = ('defines' in project) ? project['defines'][platform][config] : [];
            definesArray.forEach(item =>
            {
                definesContent += '					' + getDefineEntry(item) + ',\n';
            });

            //libPaths
            let libPathsContent = '';
            let libsPathsArray = ('libPaths' in project) ? project['libPaths'][platform][config] : [];
            libsPathsArray.forEach(item =>
            {
                item = FileHelper.relative(options.build.outputPath, item);
                libPathsContent += '					"' + item + '",\n';
            });

            //buildFlags
            let buildFlagsContent = '';
            let buildFlagsArray = ('buildFlags' in project) ? project['buildFlags'][platform][config] : [];
            buildFlagsArray.forEach(item =>
            {
                buildFlagsContent += '					"' + item + '",\n';
            });

            //linkerFlags
            let linkerFlagsContent = '';
            let linkerFlagsArray = ('linkerFlags' in project) ? project['linkerFlags'][platform][config] : [];
            linkerFlagsArray.forEach(item =>
            {
                linkerFlagsContent += '					"' + item + '",\n';
            });
            */

            let configName = Helper.capitalizeFirstLetter(config);

            //apply
            //await replace({files: projectFilePath, from: `/*DEFINES_${configKey}*/`, to: definesContent.trim()});
            await replace({files: projectFilePath, from: new RegExp(`/<\!--INCLUDES_${platform}_${configName}-->/`, 'g'), to: includePathsContent.trim()});
            //await replace({files: projectFilePath, from: `/*INCLUDES_${configKey}*/`, to: includePathsContent.trim()});
            //await replace({files: projectFilePath, from: `/*BUILD_FLAGS_${configKey}*/`, to: buildFlagsContent.trim()});
            //await replace({files: projectFilePath, from: `/*LINKER_FLAGS_${configKey}*/`, to: linkerFlagsContent.trim()});
        }
    }
}

async function applyProjectSettings(projectName, project, options)
{
    let files = [];

    files.push(options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj');
    files.push(options.build.outputPath + '/' + projectName + '.xcodeproj/project.xcworkspace/contents.xcworkspacedata');

    let plist = options.build.outputPath + '/' + projectName + '/Info.plist';
    if (fs.existsSync(plist))
        files.push(plist);

    files.map(file => path.resolve(file));

    for(let settingsKey in Globals.DEFAULT_BUILD_SETTINGS)
    {
        let val = Globals.DEFAULT_BUILD_SETTINGS[settingsKey];
        if ('settings' in project && settingsKey in project.settings)
            val = project.settings[settingsKey];

        await replace({files: files, from: new RegExp(`/\\*${settingsKey}\\*/`, 'g'), to: val.trim()});
    }

    return true;
}

async function applyIcon(projectName, project, options)
{
    const iconJson = options.build.outputPath + '/' + projectName + '/Assets.xcassets/AppIcon.appiconset/contents.json';

    if (!fs.existsSync(iconJson))
        return true;

    let iconPath = path.resolve(Globals.ICON);
    if ('icon' in project)
    {
        if (path.isAbsolute(project.icon) && fs.existsSync(project.icon))
            iconPath = project.icon;
        else
            iconPath = path.resolve(path.join(path.dirname(options.build.projectPath), project.icon));
    }

    if (!fs.existsSync(iconPath))
    {
        Logging.error('icon file not found: ', iconPath);
        throw Error('icon file not found');
    }

    let iconContent = '';

    for(let idom in Globals.XCODE_ICONS)
    {
        for(let i in Globals.XCODE_ICONS[idom])
        {
            let iconItem = Globals.XCODE_ICONS[idom][i];

            let outputIcon = 'icon_' + iconItem.name + '_' + iconItem.scale + '.png';
            let outputIconPath = path.dirname(iconJson) + '/' + outputIcon;

            await iconGenerator(iconPath, outputIconPath, iconItem.size);

            iconContent += `    {\n`;
            iconContent += `      "size" : "${iconItem.name}",\n`;
            iconContent += `      "idiom" : "${idom}",\n`;
            iconContent += `      "filename" : "${outputIcon}",\n`;
            iconContent += `      "scale" : "${iconItem.scale}"\n`;
            iconContent += `    },\n`;
        }
    }

    //remove last comma
    if (iconContent.length > 0)
        iconContent = iconContent.substr(0, iconContent.length - 2);

    await replace({files: iconJson, from: `/*ICONS*/`, to: iconContent.trim()});

    return true;
}

async function applyAssets(projectName, project, options)
{
    if (!('assets' in project))
        return;

    if (!(fs.existsSync(options.build.outputPath + '/' + projectName)))
    {
        Logging.warning('there is no content directory (assets) for this type of project: '+project.outputType);
        return;
    }

    let copyScript = projectName + '/copyAssets.sh';
    let copyScriptOutPath = options.build.outputPath + '/' + copyScript;

    let scriptContent = '';
    scriptContent += 'rm  -rf "' + path.join(projectName, Globals.DEFAULT_ASSET_DIR) + '/"\n';
    scriptContent += 'mkdir "' + path.join(projectName, Globals.DEFAULT_ASSET_DIR) + '/"\n\n';

    //create asset dir
    await fs.mkdirSync(path.join(options.build.outputPath, projectName, Globals.DEFAULT_ASSET_DIR));

    //generate copy script
    for(let i in project.assets)
    {
        let asset = project.assets[i];

        let source = path.resolve(path.join(project.workingDir, asset.source)) + '/';
        let dest = path.join(projectName, Globals.DEFAULT_ASSET_DIR, asset.destination);

        let exclude = '';
        if ('exclude' in asset)
        {
            asset.exclude.forEach(excludeItem =>
            {
                exclude += `--exclude "${excludeItem}" `;
            });
        }

        let rsync = `rsync -av ${exclude.trim()} "${source}" "${dest}"\n`;
        scriptContent += rsync;
    }

    fs.writeFileSync(copyScriptOutPath, scriptContent);
    fs.chmodSync(copyScriptOutPath, 0o744);

    let projectFilePath = options.build.outputPath + '/' + projectName + '.xcodeproj/project.pbxproj';
    await replace({files: projectFilePath, from: `/*SHELL_SCRIPT*/`, to: copyScript});
}

module.exports = makeVisualStudio;
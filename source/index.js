const fs = require('fs');
const path = require('path');

const colors = require('colors');

const Logging = require('./helper/logging');
const Helper = require('./helper/helper');

const Globals = require('./globals');

const argParser = require('./argParser');
const getAndApplyOptions = require('./options');

const help = require('./help');
const make = require('./make');
const build = require('./build');
const exp = require('./export');
const run = require('./run');
const open = require('./open');
const commands = require('./commands');
const Watcher = require('./watch');

(async () =>
{
    let watcher = new Watcher();
    let options = null;
    let running = false;
    let proc = null;

    let args = {};
    try
    {
        args = argParser();
    }
    catch(e)
    {
        Logging.error('can not parse args');
        console.log(e);
        process.exit(1);
    }
    let queueSteps = [];

    Logging.setVerbose(args.verbose);

    // ********** version **********
    if (args.version)
    {
        const json = JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'), 'utf8'));
        console.log(`${json.name} v${json.version}`);
        process.exit(0);
    }

    // ********** help **********
    if (args.help)
        help();

    // ********** main func **********
    let main = async (steps = null) =>
    {
        running = true;
        let success = true;

        try
        {
            // ********** options **********
            if (!options || (steps && steps.indexOf('options') != -1))
                options = await getAndApplyOptions(args);

            // ********** killing process if needed **********
            if (proc && options.build.killable)
                proc.kill();
            else if (proc && !options.build.killable)
                proc.detach();

            proc = null;

            // ********** create workspace files **********
            if (options.build.make && (!steps || steps.indexOf('make') != -1))
            {
                Logging.info('generating workspace...');

                success = !!(await make(options));

                Logging.log('====================');

                if (success)
                    Logging.rainbow("workspace generation was successful");

                if (!Logging.isVerbose())
                {
                    if (success)
                        Logging.out('workspace ' + options.workspace.name + ': ' + colors.green('success'));
                    else
                        Logging.out('workspace ' + options.workspace.name + ': ' + colors.green('error'));
                }
            }

            // ********** build **********
            if (success && options.build.build && (!steps || steps.indexOf('build') != -1))
            {
                Logging.info('building project...');

                success = !!(await build(options));

                Logging.log('====================');

                if (success)
                    Logging.rainbow("project built was successfully");

                if (!Logging.isVerbose())
                {
                    if (success)
                        Logging.out('build: ' + colors.green('success'));
                    else
                        Logging.out('build: ' + colors.green('error'));
                }
            }

            // ********** commands **********
            if (success && options.build.commands && (!steps || steps.indexOf('commands') != -1))
            {
                Logging.info('running commands...');

                success = !!(await commands(options));

                Logging.log('====================');

                if (success)
                    Logging.rainbow("commands were successfully executed");

                if (!Logging.isVerbose())
                {
                    if (success)
                        Logging.out('commands: ' + colors.green('success'));
                    else
                        Logging.out('commands: ' + colors.green('error'));
                }
            }

            // ********** open **********
            if (success && options.build.open && (!steps || steps.indexOf('open') != -1))
            {
                Logging.info('opening project...');

                success = !!(await open(options));

                Logging.log('====================');

                if (success)
                    Logging.rainbow("project was successfully opened");

                if (!Logging.isVerbose())
                {
                    if (success)
                        Logging.out('open: ' + colors.green('success'));
                    else
                        Logging.out('open: ' + colors.green('error'));
                }
            }

            // ********** run **********
            if (success && options.build.run && (!steps || steps.indexOf('run') != -1))
            {
                Logging.info('running project...');

                let res = await run(options, options.build.runAsync);

                if (options.build.runAsync)
                {
                    proc = res;
                    success = true;
                }
                else
                {
                    success = !!(res);

                    Logging.log('====================');

                    if (success)
                        Logging.rainbow("project run was successfully");

                    if (!Logging.isVerbose())
                    {
                        if (success)
                            Logging.out('run: ' + colors.green('success'));
                        else
                            Logging.out('run: ' + colors.green('error'));
                    }
                }
            }

            // ********** export **********
            if (success && options.build.export && (!steps || steps.indexOf('export') != -1))
            {
                Logging.info('exporting project...');

                success = !!(await exp(options));

                Logging.log('====================');

                if (success)
                    Logging.rainbow("project was exported successfully");

                if (!Logging.isVerbose())
                {
                    if (success)
                        Logging.out('export: ' + colors.green('success'));
                    else
                        Logging.out('export: ' + colors.green('error'));
                }
            }
        }
        catch (e)
        {
            Logging.error("make failed");
            Logging.out(e);
            process.exit(1);
        }

        // ********** watch **********
        const watching = options.build.watch === true || options.build.watch instanceof Array && options.build.watch.length > 0;
        if (watching)
        {
            const watchItems = options.build.watch === true ? Globals.WATCH_POSSIBILITIES : options.build.watch;
            Logging.out(colors.blue('watching (' + watchItems.join(', ')  + ')... '));

            await watcher.watch(options, watchItems, (changeType, change, steps) =>
            {
                Logging.out(colors.blue('change detected (type=' + changeType + '): ' + change));

                queueSteps = Helper.uniqueArrayItems([...steps, queueSteps])
            });
        }

        running = false;

        // end process if needed (if watcher is not runing)
        if (!watching)
            process.exit(success ? 0 : 1)
    }

    setInterval(() =>
    {
        if (!running && queueSteps.length > 0)
        {
            const steps = [...queueSteps];
            queueSteps = [];

            main(steps);
        }
    },100);

    //initial run
    await main();

})();
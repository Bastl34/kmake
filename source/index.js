const fs = require('fs');

const colors = require('colors');

const Logging = require('./helper/logging');
const Helper = require('./helper/helper');

const argParser = require('./argParser');
const getAndApplyOptions = require('./options');

const help = require('./help');
const make = require('./make');
const build = require('./build');
const exp = require('./export');
const run = require('./run');
const Watcher = require('./watch');

(async () =>
{
    let watcher = new Watcher();
    let options = null;
    let running = false;
    let proc = null;

    let args = argParser();

    let queueSteps = [];

    Logging.setVerbose(args.verbose);

    // ********** version **********
    if (args.version)
    {
        const json = JSON.parse(fs.readFileSync('package.json', 'utf8'));
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
        }

        // ********** watch **********
        if (options.build.watch)
        {
            Logging.out(colors.blue('watching...'));

            await watcher.watch(options, (changeType, change, steps) =>
            {
                Logging.out(colors.blue('change detected (type=' + changeType + '): ' + change));

                queueSteps = Helper.uniqueArrayItems([...steps, queueSteps])
            });
        }

        running = false;

        //end process if needed (if watcher is not runing)
        if (!options.build.watch)
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
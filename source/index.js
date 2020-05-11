const colors = require('colors');

const Logging = require('./helper/logging');

const argParser = require('./argParser');
const getAndApplyOptions = require('./options');

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

    let args = argParser();

    Logging.setVerbose(args.verbose);

    let func = async (changeType, change = null, steps = null) =>
    {
        running = true;
        let process = null;

        try
        {
            // ********** options **********
            if (!options || (steps && steps.indexOf('options') != -1))
                options = await getAndApplyOptions(args);

            // ********** create workspace files **********
            if (options.build.make && (!steps || steps.indexOf('make') != -1))
            {
                Logging.info('generating workspace...');

                let res = await make(options);

                Logging.log('====================');

                if (res)
                    Logging.rainbow("workspace generation was successful");

                if (!Logging.isVerbose())
                {
                    if (res)
                        Logging.out('workspace ' + options.workspace.name + ': ' + colors.green('success'));
                    else
                        Logging.out('workspace ' + options.workspace.name + ': ' + colors.green('error'));
                }
            }

            // ********** build **********
            if (options.build.build && (!steps || steps.indexOf('build') != -1))
            {
                Logging.info('building project...');

                let res = await build(options);

                Logging.log('====================');

                if (res)
                    Logging.rainbow("project built was successfully");

                if (!Logging.isVerbose())
                {
                    if (res)
                        Logging.out('build: ' + colors.green('success'));
                    else
                        Logging.out('build: ' + colors.green('error'));
                }
            }

            // ********** run **********
            if (options.build.run && (!steps || steps.indexOf('run') != -1))
            {
                Logging.info('running project...');

                let res = await run(options, options.build.runAsync);

                if (options.build.runAsync)
                {
                    process = res
                }
                else
                {
                    Logging.log('====================');

                    if (res)
                        Logging.rainbow("project run was successfully");

                    if (!Logging.isVerbose())
                    {
                        if (res)
                            Logging.out('run: ' + colors.green('success'));
                        else
                            Logging.out('run: ' + colors.green('error'));
                    }
                }
            }

            // ********** export **********
            if (options.build.export && (!steps || steps.indexOf('export') != -1))
            {
                Logging.info('exporting project...');

                let res = await exp(options);

                Logging.log('====================');

                if (res)
                    Logging.rainbow("project was exported successfully");

                if (!Logging.isVerbose())
                {
                    if (res)
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
            Logging.out('watching...');

            await watcher.watch(options, (changeType, change, steps) =>
            {
                Logging.out('change detected (type=' + changeType + '): ' + change);

                if (process && options.build.killable)
                    process.kill();
                else if (process && !options.build.killable)
                    process.detach();

                process = null;

                //TODO enqueue if running
                if (!running)
                    func(changeType, change, steps);
                else
                    Logging.error('⚠️⚠️ changing files while running is not supported at the moment ⚠️⚠️');
            });
        }

        running = false;
    }

    await func('init');

})();
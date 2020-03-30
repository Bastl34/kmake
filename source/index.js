const Logging = require('./helper/logging');

const getOptions = require('./options');

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

    let func = async (changeType, change = null, steps = null) =>
    {
        running = true;

        try
        {
            // ********** options **********
            if (!options || (steps && steps.indexOf('options') != -1))
                options = getOptions();

            // ********** create project files **********
            if (options.build.make && (!steps || steps.indexOf('make') != -1))
            {
                Logging.info('generating project...');

                let res = await make(options);

                Logging.log('====================');

                if (res)
                    Logging.rainbow("project generation was successful");
            }

            // ********** build **********
            if (options.build.build && (!steps || steps.indexOf('build') != -1))
            {
                Logging.info('building project...');

                let res = await build(options);

                Logging.log('====================');

                if (res)
                    Logging.rainbow("project built was successfully");
            }

            // ********** run **********
            if (options.build.run && (!steps || steps.indexOf('run') != -1))
            {
                Logging.info('running project...');

                let res = await run(options);

                Logging.log('====================');

                if (res)
                    Logging.rainbow("project run was successfully");
            }

            // ********** export **********
            if (options.build.export && (!steps || steps.indexOf('export') != -1))
            {
                Logging.info('exporting project...');

                let res = await exp(options);

                Logging.log('====================');

                if (res)
                    Logging.rainbow("project was exported successfully");
            }
        }
        catch (e)
        {
            Logging.error("make failed");
            Logging.log(e);
        }

        // ********** watch **********
        if (options.build.watch)
        {
            /*
            if (watcher)
                await watcher.close();
            else
                Logging.info('watching...');
            */


            Logging.info('watching...');

            await watcher.watch(options, (changeType, change, steps) =>
            {
                Logging.info('change detected (type=' + changeType + '): ' + change);

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
const fs = require('fs');

const colors = require('colors');

const Globals = require('./globals');
const Exec = require('./helper/exec');

const additionalArgs = process.argv.splice(2).join(' ');
const tempDir = Globals.TEMP_DIRS.test;

async function run(cmd)
{
    cmd = (cmd + " " + additionalArgs).trim();
    console.log(cmd);
    const p = new Exec(cmd);
    //p.on('stdout', out => console.log(out.trimRight()));
    //p.on('stderr', out => console.log(out.trimRight()));
    //p.on('error', out => console.error(out));
    //p.on('exit', code => console.log('exit with code: ' + code));

    return await p.waitForExit();
}

const tests =
{
    fullExample: async () =>
    {
        return await run(`node kmake.js examples/full --run --useInputCache --verbose 0`);
    },
    noConfig: async () =>
    {
        return await run(`node kmake.js examples/noConfig --run --useInputCache --verbose 0`);
    },
    sdl: async () =>
    {
        return await run(`node kmake.js examples/sdl --build --useInputCache --verbose 0`);
    },
    export: async () =>
    {
        return await run(`node kmake.js examples/noConfig --export --exportDest ${tempDir}/export.zip --useInputCache --verbose 0`);
    },
    lib: async () =>
    {
        return await run(`node kmake.js examples/lib --useInputCache --verbose 0`);
    },
};

(async () =>
{
    try
    {
        let successful = 0;
        let testAmount = Object.keys(tests).length;

        for(let testName in tests)
        {
            // prepare data dir
            if (fs.existsSync(tempDir))
                await fs.promises.rmdir(tempDir, {recursive: true});
            await fs.promises.mkdir(tempDir);

            // run test
            try
            {
                process.stdout.write(`test "${testName}" running... `);
                const res = await tests[testName]();

                if (!res)
                {
                    console.log(colors.red('FAILED'));
                    continue;
                }

                console.log(colors.green('SUCCESS'));

                ++successful;
            }
            catch(e)
            {
                console.log(colors.red('FAILED'));
            }
        }

        console.log(`[${successful}/${testAmount}] tests successful`);

        if (successful == testAmount)
            console.log(colors.rainbow('✔✔✔ all tests successful ✔✔✔'));
        else
            console.error(colors.red('❌❌❌ tests failed ❌❌❌'));

        // cleanup
        if (fs.existsSync(tempDir))
            await fs.promises.rmdir(tempDir, {recursive: true});

        process.exit(successful == testAmount ? 0 : 1);
    }
    catch (e)
    {
        console.error(colors.red('❌❌❌ tests failed ❌❌❌'));
        console.error(e);

        process.exit(1);
    }
})();
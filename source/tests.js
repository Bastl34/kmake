const fs = require('fs');
const os = require('os');

const colors = require('colors');

const Globals = require('./globals');
const Exec = require('./helper/exec');

const additionalArgs = process.argv.splice(2).join(' ');
const tempDir = Globals.TEMP_DIRS.test;

async function run(cmd)
{
    cmd = (cmd + " " + additionalArgs).trim();
    const p = new Exec(cmd);
    //p.on('stdout', out => console.log(out.trimRight()));
    //p.on('stderr', out => console.log(out.trimRight()));
    //p.on('error', out => console.error(out));
    //p.on('exit', code => console.log('exit with code: ' + code));

    return await p.waitForExit();
}

const tests =
{
    fullExample:
    {
        func: async () =>
        {
            return await run(`node kmake.js examples/full --run --skipInput --verbose 0`);
        }
    },
    fullExampleMakefile:
    {
        platform: ['darwin'],
        func: async () =>
        {
            return await run(`node kmake.js examples/full --template mk --run --skipInput --verbose 0`);
        }
    },
    noConfig:
    {
        func: async () =>
        {
            return await run(`node kmake.js examples/noConfig --run --skipInput --verbose 0`);
        }
    },
    sdl:
    {
        func: async () =>
        {
            return await run(`node kmake.js examples/sdl --build --skipInput --verbose 0`);
        }
    },
    export:
    {
        func: async () =>
        {
            return await run(`node kmake.js examples/noConfig --export --exportDest ${tempDir}/export.zip --skipInput --verbose 0`);
        }
    },
    lib:
    {
        func: async () =>
        {
            return await run(`node kmake.js examples/lib --skipInput --verbose 0`);
        }
    },
    thread:
    {
        func: async () =>
        {
            return await run(`node kmake.js examples/thread --run --skipInput --verbose 0`);
        }
    },
    threadClang:
    {
        platform: ['linux', 'darwin'],
        func: async () =>
        {
            return await run(`node kmake.js examples/thread --run --skipInput --verbose 0 --MK_CC=clang++`);
        }
    },
};

(async () =>
{
    try
    {
        let successful = 0;
        let testAmount = 0;

        for(let testName in tests)
        {
            // prepare data dir
            if (fs.existsSync(tempDir))
                await fs.promises.rmdir(tempDir, {recursive: true});
            await fs.promises.mkdir(tempDir);

            if ('platform' in tests[testName] && !tests[testName].platform.includes(os.platform()))
                continue;

            ++testAmount;

            // run test
            try
            {
                process.stdout.write(`test "${testName}" running... `);
                const res = await tests[testName].func();

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
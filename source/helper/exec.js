const { spawn } = require('child_process')
const kill = require('tree-kill')

const Exec =
{
    splitBySpaceWithQuotes: str =>
    {
        // https://stackoverflow.com/a/46946633
        return str.match(/\\?.|^$/g).reduce
        (
            (p, c) =>
            {
                if (c === '"')
                    p.quote ^= 1;
                else if (!p.quote && c === ' ')
                    p.a.push('');
                else
                    p.a[p.a.length - 1] += c.replace(/\\(.)/, '$1');

                return p;
            },
            { a: [''] }
        ).a;
    },

    kill(process)
    {
        kill(process.pid)
    },

    run: (cmd, callback) =>
    {
        // replace windows paths (for splitBySpaceWithQuotes)
        cmd = cmd.replace(/\\/g, '/');

        const splits = this.splitBySpaceWithQuotes(cmd);
        const program = splits[0];
        const params = splits.slice(1);

        const process = spawn(program, params)

        process.stdout.on('data', data =>
        {
            callback({stdout: data});
        });

        spawnedProcess.stderr.on('data', data =>
        {
            callback({stderr: data});
        });

        spawnedProcess.on('error', data =>
        {
            callback({error: data});
        });

        spawnedProcess.on('exit', code =>
        {
            callback({exit: code});
        });

        return process;
    }
}

module.exports = Exec

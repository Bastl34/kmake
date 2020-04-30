const { spawn } = require('child_process');
const kill = require('tree-kill');
const EventEmitter = require('events');

const splitBySpaceWithQuotes = str =>
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
}


class Exec extends EventEmitter
{
    constructor(cmd, cwd = null)
    {
        super();

        this.process = null;

        this.run(cmd, cwd);
    }

    run(cmd, cwd = null)
    {
        // replace windows paths (for splitBySpaceWithQuotes)
        cmd = cmd.replace(/\\/g, '/');

        const splits = splitBySpaceWithQuotes(cmd);
        const program = splits[0];
        const params = splits.slice(1);

        const options = {};
        if (cwd)
            options.cwd = cwd;

        this.process = spawn(program, params, options);

        this.process.stdout.on('data', data =>
        {
            this.emit('stdout', data.toString());
        });

        this.process.stderr.on('data', data =>
        {
            this.emit('stdout', data.toString());
        });

        this.process.on('error', data =>
        {
            this.emit('exit', data);
        });

        this.process.on('exit', code =>
        {
            this.emit('exit', code);
            this.emit('_exit', code);
            this.process = null;
        });
    }

    kill()
    {
        if (this.process)
            kill(this.process.pid);

        this.process = null;
    }

    detach()
    {
        const events = this.eventNames();

        events.forEach(eventName =>
        {
            this.removeAllListeners(eventName);
        });

        if (this.process)
            this.process.unref();
    }

    async waitForExit()
    {
        return new Promise((resolve, reject) =>
        {
            this.on('_exit', (exitCode) =>
            {
                resolve(exitCode == 0 ? true : false);
            });
        });
    }
}

module.exports = Exec

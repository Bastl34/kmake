const { spawn } = require('child_process');
const kill = require('tree-kill');
const EventEmitter = require('events');

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

        const options = { shell: true };
        if (cwd)
            options.cwd = cwd;

        this.process = spawn(cmd, options);

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
        if (this.process && this.process.pid)
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

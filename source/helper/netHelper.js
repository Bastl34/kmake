const fs = require('fs');

const axios = require('axios');

let NetHelper =
{
    async getDownloadSize(url)
    {
        return new Promise((resolve, reject) =>
        {
            axios({method: "head", url: url}).then((response) =>
            {
                if ('content-length' in response.headers)
                    resolve(parseInt(response.headers['content-length']));
                else
                    reject('can not get download size');
            }).catch(err => reject(err));
        })
    },

    async download(url, dest)
    {
        return new Promise((resolve, reject) =>
        {
            axios({method: "get", url: url, responseType: "stream"}).then((response) =>
            {
                let stream = fs.createWriteStream(dest);

                stream.on('close', () => resolve());
                stream.on('error', err => reject(err));

                response.data.pipe(stream);
            }).catch(err => reject(err));
        })
    },
};


module.exports = NetHelper;
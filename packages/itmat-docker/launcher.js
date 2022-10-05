const express = require('express');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const ITMATInterface = require('./interface').default;
const ITMATJobExecutor = require('./executor').default;
const path = require('node:path');
const fs = require('node:fs');
const url = require('node:url');
const config = require('./config/config.json');

let root = express();
let interface = new ITMATInterface(config);
let executor = new ITMATJobExecutor(config);

Promise.all([
    interface.start(),
    executor.start(),
]).then(routers => {

    // For production activating reponse compression
    root.use(compression());

    routers.forEach((router) => {
        // Linking itmat's router on /api
        root.use('/', router.getApp());
    });

    root.use(rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 500
    }));

    // Referencing any other requests to the /public/index.html
    root.use('*', (req, res) => {
        const targetFile = path.posix.join(__dirname, url.parse(req.originalUrl).pathname);
        if (fs.existsSync(targetFile))
            return res.sendFile(targetFile);
        else
            return res.sendFile(path.posix.join(__dirname, 'index.html'));
    });

    root.listen(3080, error => {
        if (error !== undefined && error !== null) {
            console.error(error); // eslint-disable-line no-console
            return;
        }
    });
}, error => {
    console.error(error);
});

const express = require('express');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const ITMATInterface = require('./interface').default;
const ITMATJobExecutor = require('./executor').default;
const path = require('path');
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

    // Binding static resources folder
    root.use('/favicon.ico', express.static(path.normalize(`${__dirname}/static/favicon.ico`)));
    root.use('/manifest.json', express.static(path.normalize(`${__dirname}/static/manifest.json`)));
    root.use('/static', express.static(path.normalize(`${__dirname}/static`)));

    root.use(rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 500
    }));

    // Referencing any other requests to the /public/index.html
    root.use('*', (__unused__req, res) => {
        res.sendFile(path.resolve('static/index.html'));
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

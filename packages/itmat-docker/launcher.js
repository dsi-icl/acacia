
const express = require('express');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const OptimiseServer = require('./server').default;
const path = require('path');

let root = express();
let optimise = new OptimiseServer();

optimise.start().then(router => {

    // For production activating reponse compression
    root.use(compression());

    // Linking optimise's router on /api
    root.use('/api', router);

    // Binding static resources folder
    root.use('/static', express.static(path.normalize(`${__dirname}/static`)));

    root.use(new rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 500
    }));

    // Referencing any other requests to the /public/index.html
    root.use('*', (__unused__req, res) => {
        res.sendFile(path.resolve('static/index.html'));
    });

    root.listen(3030, error => {
        if (error !== undefined && error !== null) {
            console.error(error); // eslint-disable-line no-console
            return;
        }
    });
}, error => {
    console.error(error);
});
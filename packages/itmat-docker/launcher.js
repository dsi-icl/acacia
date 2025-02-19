const express = require('express');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const sanitize = require("sanitize-filename");
const ITMATInterface = require('./interface').default;
const ITMATJobExecutor = require('./executor').default;
const path = require('node:path');
const fs = require('node:fs');
const url = require('node:url');
const http = require('node:http');
const config = require('./config/config.json');

let root = express();
let server;
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

    root.set('trust proxy', 1);

    root.use(rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 500
    }));

    // Referencing any other requests to the /public/index.html
    root.use('*', (req, res) => {
        const sanitizedUrl = url.parse(req.originalUrl).pathname.split('/').map(sanitize).filter(Boolean)
        const targetFile = path.posix.join(__dirname, ...sanitizedUrl);
        if (fs.existsSync(targetFile) && fs.lstatSync(targetFile).isFile())
            return res.sendFile(targetFile);
        else
            return res.sendFile(path.posix.join(__dirname, 'index.html'));
    });

    server = http.createServer({
        allowHTTP1: true,
        keepAlive: true,
        keepAliveInitialDelay: 0,
        requestTimeout: 0,
        headersTimeout: 0,
        noDelay: true
    }, root);

    server.timeout = 0;
    server.headersTimeout = 0;
    server.requestTimeout = 0;
    server.keepAliveTimeout = 1000 * 60 * 60 * 24 * 5;
    server.on('connection', (socket) => {
        socket.setKeepAlive(true);
        socket.setNoDelay(true)
        socket.setTimeout(0);
        socket.timeout = 0;
    });
    
    // Add WebSocket upgrade handling
    server.on('upgrade', (req, socket, head) => {
        // Forward WebSocket upgrade to the interface
        if (interface.router) {
            interface.router.getServer().emit('upgrade', req, socket, head);
        } else {
            console.error('No WebSocket upgrade handler available for URL:', req.url);
            socket.destroy();
        }
    });

    try {
        server.listen(config.server.port, () => {
            console.info(`Listening at http://localhost:${config.server.port}/`);
        })
    } catch (error) {
        console.error(error);
    }

}, error => {
    console.error(error);
});

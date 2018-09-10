const jsonstream = require('JSONStream');
const { status, msg } = require('itmat-broker-core').Utils;

module.exports = function (config, database, fileStorage) {
    const controller = {};

    controller.notFound = function (req, res) {
        res.redirect('/');
    };

    controller.internalServerError = function (err, req, res) {
        database.logInternalServerError(err, req);
        res.status(status.INTERNAL_SERVER_ERROR).send(msg[status.INTERNAL_SERVER_ERROR]);
    };

    controller.checkToken = async function (req, res, next) {
        try {
            if (!req.token) {
                res.status(status.BAD_REQUEST).send('Token not found in the request');
            } else {
                const username = await database.consumeTokenAndGetUsername(req.token);
                if (!username) {
                    res.status(status.UNAUTHORIZED).send('Token found but not valid or active');
                } else {
                    req.username = username;
                    next();
                }
            }
        } catch (error) { next(error); }
    };

    controller.regenerateToken = async function (req, res, next) {
        try {
            const token = await database.regenerateToken(req.username);
            res.set('next-token', token);
            next();
        } catch (error) { next(error); }
    };

    controller.login = async function (req, res, next) {
        try {
            const token = await database.regenerateToken(req.user.cn);
            console.log(req.user);
            res.status(status.OK).send(token);
        } catch (error) { next(error); }
    };

    controller.logout = async function (req, res, next) {
        try {
            await database.deactivateTokenByUsername(req.username);
            res.status(status.OK).send();
        } catch (error) { next(error); }
    };

    controller.applications = async function (req, res, next) {
        try {
            const { username } = req;
            const applications = await database.getUserApplications(username);
            res.json(applications);
        } catch (error) { next(error); }
    };

    controller.data = async function (req, res, next) {
        try {
            const { username } = req;
            const { application, key } = req.params;
            const cursor = await database.requestDataset(username, application, key);
            if (cursor !== null) {
                res.set('Content-Type', 'application/json');
                cursor.pipe(jsonstream.stringify()).pipe(res);
            } else {
                res.status(status.FORBIDDEN).send(msg[status.FORBIDDEN]);
            }
        } catch (error) { next(error); }
    };

    controller.file = async function (req, res, next) {
        try {
            const { username } = req;
            const filename = req.params.filename;
            const file = await fileStorage.requestFileContent(username, filename);
            if (file !== null) {
                res.set('Content-Type', 'application/octet-stream');
                file.pipe(res);
            }
            else {
                res.status(status.FORBIDDEN).send(msg[status.FORBIDDEN]);
            }
        } catch (error) { next(error); }
    };

    controller.metadata = async function (req, res, next) {
        try {
            const { username } = req;
            const filename = req.params.filename;
            const metadata = await fileStorage.requestPublicMetadata(username, filename);
            if (metadata !== null) res.json(metadata);
            else res.status(status.FORBIDDEN).send(msg[status.FORBIDDEN]);
        } catch (error) { next(error); }
    };

    return controller;
};

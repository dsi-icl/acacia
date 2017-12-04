const jsonstream = require('JSONStream');
const { status, msg } = require('../shared/utils');

module.exports = function (config, database, fileStorage) {
  const controller = {};

  controller.notFound = function (req, res) {
    res.status(status.NOT_FOUND).send(msg[status.NOT_FOUND]);
  };

  controller.internalServerError = function (err, req, res, next) {
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
      const token = await database.regenerateToken(req.user.uid);
      res.status(status.OK).send(token);
    } catch (error) { next(error); }
  };

  controller.logout = async function (req, res, next) {
    try {
      await database.invalidateTokenByUsername(req.username);
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
      const { applicationid, key } = req.query;
      const cursor = await database.requestDataset(username, applicationid, key);
      cursor.pipe(jsonstream.stringify()).pipe(res);
    } catch (error) { next(error); }
  };

  controller.file = async function (req, res, next) {
    try {
      const { username } = req;
      const filename = req.query.name;
      const file = await fileStorage.requestFileContent(username, filename);
      if (file !== null) file.pipe(res);
      else res.status(status.FORBIDDEN).send(msg[status.FORBIDDEN]);
    } catch (error) { next(error); }
  };

  controller.metadata = async function (req, res, next) {
    try {
      const { username } = req;
      const filename = req.query.name;
      const metadata = await fileStorage.requestPublicMetadata(username, filename);
      if (metadata !== null) res.json(metadata);
      else res.status(status.FORBIDDEN).send(msg[status.FORBIDDEN]);
    } catch (error) { next(error); }
  };

  return controller;
};

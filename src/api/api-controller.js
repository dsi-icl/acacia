const jsonstream = require('JSONStream');
const { status, msg } = require('../shared/utils');

module.exports = function (config, database, filebase) {
  const controller = {};

  controller.pageNotFoundRoute = function (req, res) {
    res.status(status.NOT_FOUND).json({ error: msg[status.NOT_FOUND] });
  };

  controller.pageError = function (err, req, res) {
    res.status(status.INTERNAL_SERVER_ERROR).json({ error: msg[status.INTERNAL_SERVER_ERROR] });
  };

  controller.checkAuthentication = async function (req, res, next) {
    try {
      if (!req.token) throw Error('Token not found in the request');
      const username = await database.consumeTokenAndGetUsername(req.token);
      if (!username) throw Error('Invalid token');
      req.username = username;
      next();
    } catch (error) {
      res.status(status.UNAUTHORIZED).json({ error: msg[status.UNAUTHORIZED] });
    }
  };

  controller.tokenRegeneration = async function (req, res, next) {
    try {
      const token = await database.regenerateToken(req.username);
      res.set('next-token', token);
      next();
    } catch (error) {
      res.status(status.BAD_REQUEST).json({ error: 'Error regenerating token' });
    }
  };

  controller.apiLogin = async function (req, res) {
    const token = await database.regenerateToken(req.user.uid);
    res.status(status.OK).send(token);
  };

  controller.apiLogout = async function (req, res) {
    await database.invalidateTokenByUsername(req.username);
    res.status(status.OK).send({});
  };

  controller.apiApplications = async function (req, res) {
    const { username } = req;
    const applications = await database.getUserApplications(username);
    res.json(applications);
  };

  controller.apiData = async function (req, res) {
    const { username } = req;
    const { applicationid, key } = req.query;
    const cursor = await database.requestDataset(username, applicationid, key);
    cursor.pipe(jsonstream.stringify()).pipe(res);
  };

  controller.apiDownload = async function (req, res) {
    const { username } = req;
    const filename = req.query.name;
    const file = await filebase.requestFile(username, filename);
    if(file) file.pipe(res);
    else res.status(status.FORBIDDEN).json({ error: msg[status.FORBIDDEN] });
  };

  return controller;
};

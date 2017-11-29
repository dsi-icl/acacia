const jsonstream = require('JSONStream');

module.exports = function (config, database, filebase) {
  const controller = {};

  controller.pageNotFoundRoute = function (req, res) {
    res.status(404).json({ error: 'Page not found' });
  };

  controller.pageError = function (err, req, res) {
    res.status(500).json({ error: 'Internal server error' });
  };

  controller.checkAuthentication = async function (req, res, next) {
    try {
      if (!req.token) throw Error('Token not found in the request');
      const username = await database.consumeTokenAndGetUsername(req.token);
      if (!username) throw Error('Invalid token');
      req.username = username;
      next();
    } catch (error) {
      res.status(401).json({ error: 'No authenticated' });
    }
  };

  controller.tokenRegeneration = async function (req, res, next) {
    try {
      const token = await database.regenerateToken(req.username);
      res.set('next-token', token);
      next();
    } catch (error) {
      res.status(401).json({ error: 'Error regenerating token' });
    }
  };

  controller.apiLogin = async function (req, res) {
    const token = await database.regenerateToken(req.user.uid);
    res.status(200).send(token);
  };

  controller.apiLogout = async function (req, res) {
    await database.invalidateTokenByUsername(req.username);
    res.status(200).send({});
  };

  controller.apiApplications = async function (req, res) {
    const { username } = req;
    const applications = await database.getUserApplications(username);
    res.json(applications);
  };

  controller.apiData = async function (req, res) {
    const { username, applicationid, key } = req.query;
    const cursor = await database.requestDataset(username, applicationid, key);
    cursor.pipe(jsonstream.stringify()).pipe(res);
  };

  controller.apiDownload = async function (req, res) {
    const { username } = req;
    const filename = req.query.file;
    const file = await filebase.requestFile(username, filename);
    file.pipe(res);
  };

  return controller;
};

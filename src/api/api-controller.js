const jsonstream = require('JSONStream');
const jwt = require('jsonwebtoken');


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
      const decodedToken = await jwt.verify(req.token, config.api.token_secret);
      req.tokenUid = decodedToken.uid;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Not authenticated' });
    }
  };

  controller.apiLogin = async function (req, res) {
    const token = jwt.sign({ uid: req.user.uid }, config.api.token_secret, { expiresIn: '10m' });
    res.status(200).send(token);
  };

  controller.apiApplications = async function (req, res) {
    const username = req.tokenUid;
    const applications = await database.getUserApplications(username);
    res.json(applications);
  };

  controller.apiData = async function (req, res) {
    const username = req.tokenUid;
    const { applicationid, key } = req.query;
    const cursor = await database.requestDataset(username, applicationid, key);
    cursor.pipe(jsonstream.stringify()).pipe(res);
  };

  controller.apiDownload = async function (req, res) {
    const username = req.tokenUid;
    const filename = req.query.file;
    const file = await filebase.requestFile(username, filename);
    file.pipe(res);
  };

  return controller;
};

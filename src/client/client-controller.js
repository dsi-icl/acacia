const jsonstream = require('JSONStream');
const { status } = require('../shared/utils');

module.exports = function (database, fileStorage) {
  const controller = {};

  controller.notFound = function (req, res) {
    res.status(status.NOT_FOUND).render('404');
  };

  controller.internalServerError = function (err, req, res) {
    res.status(status.INTERNAL_SERVER_ERROR).render('500');
  };

  controller.checkAuthentication = function (req, res, next) {
    if (req.isAuthenticated()) { next(); } else { res.redirect('/'); }
  };

  controller.root = async function (req, res, next) {
    try {
      if (req.isAuthenticated()) {
        const username = req.session.passport.user.uid;
        const applications = await database.getUserApplications(username);
        res.render('details', { applications });
      } else {
        res.render('login', req.flash());
      }
    } catch (error) { next(error); }
  };

  controller.logout = function (req, res) {
    req.logout();
    res.redirect('/');
  };

  controller.file = async function (req, res, next) {
    try {
      const username = req.session.passport.user.uid;
      const filename = req.query.name;
      const file = await fileStorage.requestFileContent(username, filename);
      if (file) file.pipe(res);
      else res.status(status.FORBIDDEN).render('download_failed');
    } catch (error) { next(error); }
  };

  controller.data = async function (req, res, next) {
    try {
      const username = req.user.uid;
      const { applicationid, key } = req.query;
      const cursor = await database.requestDataset(username, applicationid, key);
      if (cursor) cursor.pipe(jsonstream.stringify()).pipe(res);
      else res.status(status.FORBIDDEN).render('download_failed');
    } catch (error) { next(error); }
  };

  return controller;
};

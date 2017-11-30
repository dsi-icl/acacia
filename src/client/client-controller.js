const jsonstream = require('JSONStream');
const { status, msg } = require('../shared/utils');

module.exports = function (database, filebase) {
  const controller = {};

  controller.mainRoute = async function (req, res, next) {
    if (req.isAuthenticated()) {
      try {
        const username = req.session.passport.user.uid;
        const applications = await database.getUserApplications(username);
        res.render('details', { applications });
      } catch (error) { next(error); }
    } else {
      res.render('login', req.flash());
    }
  };

  controller.downloadRoute = async function (req, res) {
    try {
      const username = req.session.passport.user.uid;
      const filename = req.query.file;
      const file = await filebase.requestFile(username, filename);
      if(file) file.pipe(res);
      else throw Error('You can not access the specified file');
    } catch (error) { res.status(status.FORBIDDEN).render('download_failed', { error }); }
  };

  controller.downloadData = async function (req, res) {
    try {
      const username = req.user.uid;
      const { applicationid, key } = req.query;
      const cursor = await database.requestDataset(username, applicationid, key);
      cursor.pipe(jsonstream.stringify()).pipe(res);
    } catch (error) { res.status(status.FORBIDDEN).render('download_failed', { error }); }
  };

  controller.logoutRoute = function (req, res) {
    req.logout();
    res.redirect('/');
  };

  controller.pageNotFoundRoute = function (req, res) {
    res.status(status.NOT_FOUND).render('404');
  };

  controller.pageError = function (err, req, res) {
    res.status(status.INTERNAL_SERVER_ERROR).render('500');
  };

  controller.ensureAuthenticated = function (req, res, next) {
    if (req.isAuthenticated()) { next(); } else { res.redirect('/'); }
  };

  return controller;
};

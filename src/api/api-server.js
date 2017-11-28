const express = require('express');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const cors = require('cors');
const basicAuth = require('basic-auth');
const bearerToken = require('express-bearer-token');

const createController = require('./api-controller');
const Server = require('./../shared/server.js');

class ApiServer extends Server {
  createApplication() {
    const controller = createController(this.config, this.database, this.filebase);
    const app = express();

    passport.use('ldap_auth_with_basicauth', new LdapStrategy({
      server: this.config.ldap_authentication,
      credentialsLookup: basicAuth,
    }));

    passport.serializeUser((user, done) => { done(null, user); });
    passport.deserializeUser((user, done) => { done(null, user); });

    app.disable('x-powered-by');

    app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
    app.set('view engine', 'handlebars');

    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use(bearerToken());
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(cors());

    app.get('/login', passport.authenticate('ldap_auth_with_basicauth', { session: false }), controller.apiLogin);
    app.get('/applications', controller.checkAuthentication, controller.apiApplications);
    app.get('/file', controller.checkAuthentication, controller.apiDownload);
    app.get('/data', controller.checkAuthentication, controller.apiData);
    app.use(controller.pageNotFoundRoute);
    app.use(controller.pageError);

    return app;
  }

  getServerConfig() {
    return this.config.api;
  }
}


module.exports = ApiServer;

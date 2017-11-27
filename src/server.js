const express = require('express');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const https = require('https');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const cors = require('cors');
const flash = require('connect-flash');
const mongodb = require('mongodb');
const fs = require('fs');
const connectMongo = require('connect-mongo');
const basicAuth = require('basic-auth');

const Database = require('./database');
const Filebase = require('./filebase');
const createController = require('./controller');

class Server {
  constructor(configValues) {
    this.config = Server.createConfig(configValues);
  }

  async start() {
    const db = await mongodb.MongoClient.connect(this.config.values.database.mongo_url);
    const database = new Database(db, mongodb.ObjectId, this.config);
    const filebase = new Filebase(this.config, database);
    const controller = createController(database, filebase);
    const app = Server.createApp(this.config, controller);
    return https.createServer(this.config.serverOptions, app)
      .listen(this.config.values.server.port);
  }

  static createApp(config, controller) {
    const app = express();

    passport.use('ldap_auth', new LdapStrategy(config.ldapOptions));
    passport.use('ldap_auth_with_basicauth', new LdapStrategy(config.ldapOptionsWithBasicAuth));

    passport.serializeUser((user, done) => { done(null, user); });
    passport.deserializeUser((user, done) => { done(null, user); });

    app.disable('x-powered-by');

    app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
    app.set('view engine', 'handlebars');

    app.use(express.static('public'));
    app.use(flash());
    app.use(cookieParser());
    app.use(session(config.sessionOptions));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(passport.initialize());
    app.use(passport.session());

    app.use('/api', cors(), passport.authenticate('ldap_auth_with_basicauth', { session: false }));
    app.get('/api/applications', controller.apiApplications);
    app.get('/api/file', controller.apiDownload);
    app.get('/api/data', controller.apiData);

    app.get('/', controller.mainRoute);
    app.post('/login', passport.authenticate('ldap_auth', { successRedirect: '/', failureRedirect: '/', failureFlash: true }));
    app.get('/logout', controller.logoutRoute);
    app.get('/download', controller.ensureAuthenticated, controller.downloadRoute);
    app.get('/data', controller.ensureAuthenticated, controller.downloadData);
    app.use(controller.pageNotFoundRoute);
    app.use(controller.pageError);

    return app;
  }

  static createConfig(configValues) {
    const MongoStore = connectMongo(session);

    return {
      values: configValues,

      ldapOptions: {
        server: configValues.ldap_authentication,
      },

      ldapOptionsWithBasicAuth: {
        server: configValues.ldap_authentication,
        credentialsLookup: basicAuth,
      },

      serverOptions: {
        key: fs.readFileSync(configValues.server.key_file),
        cert: fs.readFileSync(configValues.server.certificate_file),
      },

      sessionOptions: {
        secret: configValues.database.secret,
        store: new MongoStore({ url: configValues.database.mongo_url }),
        resave: false,
        saveUninitialized: true,
        cookie: { secure: true },
      },

    };
  }
}

module.exports = Server;

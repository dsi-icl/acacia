const express = require('express');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const flash = require('connect-flash');
const connectMongo = require('connect-mongo');

const createController = require('./client-controller');
const Server = require('./../shared/server.js');

class ClientServer extends Server {
  createApplication() {
    const controller = createController(this.database, this.fileStorage);
    const app = express();

    passport.use('ldap_auth', new LdapStrategy({
      server: this.config.ldap_authentication,
    }));

    const MongoStore = connectMongo(session);

    const sessionOptions = {
      secret: this.config.database.secret,
      store: new MongoStore({
        url: this.config.database.mongo_url,
        collection: this.config.database.sessions_collection,
      }),
      resave: false,
      saveUninitialized: true,
      cookie: { secure: true },
    };

    passport.serializeUser((user, done) => { done(null, user); });
    passport.deserializeUser((user, done) => { done(null, user); });

    app.disable('x-powered-by');

    app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
    app.set('view engine', 'handlebars');

    app.use(express.static('public'));
    app.use(flash());
    app.use(cookieParser());
    app.use(session(sessionOptions));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use(passport.initialize());
    app.use(passport.session());

    app.get('/', controller.root);
    app.post('/login', passport.authenticate('ldap_auth', { successRedirect: '/', failureRedirect: '/', failureFlash: true }));
    app.get('/logout', controller.checkAuthentication, controller.logout);
    app.get('/file', controller.checkAuthentication, controller.file);
    app.get('/data', controller.checkAuthentication, controller.data);
    app.use(controller.notFound);
    app.use(controller.internalServerError);

    return app;
  }

  getServerConfig() {
    return this.config.client;
  }
}

module.exports = ClientServer;

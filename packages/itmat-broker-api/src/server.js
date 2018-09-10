const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const LdapStrategy = require('passport-ldapauth');
const cors = require('cors');
const basicAuth = require('basic-auth');
const bearerToken = require('express-bearer-token');
const swaggerUi = require('swagger-ui-express');
const yamljs = require('yamljs');

const createController = require('./controller');
const Server = require('itmat-broker-core').Server;

class ApiServer extends Server {
    createApplication() {
        const controller = createController(this.config, this.database, this.fileStorage);
        const app = express();

        const swaggerDocumentation = yamljs.load('./swagger.yaml');
        let swaggerUiExplorer = false;
        let swaggerUiOptions = {};
        let swaggerUiCss = '.topbar { display: none }';
        const swaggerSetup = swaggerUi
            .setup(swaggerDocumentation, swaggerUiExplorer, swaggerUiOptions, swaggerUiCss,
                '/favicon.png', false, 'ITMAT Broker API');

        passport.use('ldap_auth_with_basicauth', new LdapStrategy({
            server: this.config.ldap_authentication,
            credentialsLookup: basicAuth,
        }));

        passport.serializeUser((user, done) => { done(null, user); });
        passport.deserializeUser((user, done) => { done(null, user); });

        app.disable('x-powered-by');

        app.use(swaggerUi.serve);
        app.use(express.static('public'));
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());
        app.use(bearerToken());
        app.use(passport.initialize());
        app.use(cors());

        app.get('/login', passport.authenticate('ldap_auth_with_basicauth', { session: false }), controller.login);
        app.get('/logout', controller.checkToken, controller.logout);
        app.get('/applications', controller.checkToken, controller.regenerateToken, controller.applications);
        app.get('/file/:filename', controller.checkToken, controller.regenerateToken, controller.file);
        app.get('/metadata/:filename', controller.checkToken, controller.regenerateToken, controller.metadata);
        app.get('/data/:application/:key', controller.checkToken, controller.regenerateToken, controller.data);
        app.get('/', swaggerSetup);
        app.use(controller.notFound);
        app.use(controller.internalServerError);

        return app;
    }

    getServerConfig() {
        return this.config.api;
    }
}


module.exports = ApiServer;

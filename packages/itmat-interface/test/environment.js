/*eslint no-console: "off"*/

'use strict';

const server = require('../../dist/src/server/server').Server;
const NodeEnvironment = require('jest-environment-node');
const config = require('./config');
const { MongoClient } = require('mongodb');
const { db } = require('../../dist/src/database/database');
const { OpenStackSwiftObjectStore } = require('itmat-utils');
const { FileController, UserController, QueryController } = require('../../dist/src/RESTControllers');
const { Router } = require('../../dist/src/server/router');
const { setupDatabase } = require('itmat-utils/src/databaseSetup/collectionsAndIndexes');
const { connectionString, database, mongoClient } = require('./inMemoryMongo');

let app;
let objStore;
let mongo;

class ItmatNodeEnvironment extends NodeEnvironment {

    constructor(config) {
        super(config);
    }

    static async globalSetup() {
        process.env.NODE_ENV = 'test';

        /* Creating a in-memory MongoDB instance for testing */
        mongo = new MongoClient(config.database.mongo_url, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        /* Setting up the collections and seeds in the database */
        await setupDatabase(connectionString, database);
        console.log('Finished setting up database.');

        /* Setting up the app (webserver) */
        objStore = new OpenStackSwiftObjectStore(config.swift);


        config.database.mongo_url = connectionString;
        config.database.database = database;

        return db.connect(config.database)
            .then(() => objStore.connect())
            .then(() => {
                const userController = new UserController(db.collections.users_collection);
                const fileController = new FileController(db, objStore);
                const router = new Router(db, userController, fileController);
                app = router.getApp();
                return true;
            }).catch(err => {
                console.error(err);
            });
    }

    static async globalTeardown() {
        await mongo.close();
        await objStore.disconnect();
        await db.closeConnection();
        await mongodb.stop();
    }

    async setup() {
        super.setup();
        this.global._APP_ = app;  // binding the app to jest global object 
        this.global._MONGODB_ = mongo; // binding the mongo instance to jest global object
    }

    async teardown() {
        super.teardown();
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = ItmatNodeEnvironment;
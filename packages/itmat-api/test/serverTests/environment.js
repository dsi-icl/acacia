/*eslint no-console: "off"*/

'use strict';

const server = require('../../dist/src/server/server').Server;
const NodeEnvironment = require('jest-environment-node');
const config = require('./config');
const mongodb = require('./inMemoryMongo');
const { MongoClient } = require('mongodb');
const { Database } = require('../../dist/src/database/database');
const { OpenStackSwiftObjectStore } = require('itmat-utils');
const { FileController, UserController, QueryController } = require('../../dist/src/RESTControllers');
const { Router } = require('../../dist/src/server/router');
const users = require('../seed/users');

let app;
let mongo;
let db;

class ItmatNodeEnvironment extends NodeEnvironment {

    constructor(config) {
        super(config);
    }

    static async globalSetup() {
        process.env.NODE_ENV = 'test';

        console.log(await mongodb.getConnectionString());
        config.database.mongo_url = await mongodb.getConnectionString();
        config.database.database = await mongodb.getDbName();
        mongo = new MongoClient(config.database.mongo_url, { useNewUrlParser: true });
        await mongo.connect();
        const database = mongo.db(config.database.database);
        for (let each in config.database.collections) {
            await database.createCollection(config.database.collections[each]);
        }
        await database.collection(config.database.collections.users_collection).insert(users);

        db = new Database(config.database);
        const objStore = new OpenStackSwiftObjectStore(config.swift);

        return new server(config, db, objStore)
            .connectToBackEnd()
            .then(() => {
                const userController = new UserController(db.users_collection);
                const fileController = new FileController(db, objStore);
                const queryController = new QueryController(db.queries_collection);
                const router = new Router(db, userController, fileController, queryController);
                app = router.getApp();
                return true;
            }).catch(err => {
                console.error(err);
            });
    }

    static async globalTeardown() {
        await mongo.close();
        await db.closeConnection();
        await mongodb.stop();
    }

    async setup() {
        super.setup();
        this.global._APP_ = app;
        this.global._MONGODB_ = mongo;
    }

    async teardown() {
        super.teardown();
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = ItmatNodeEnvironment;
import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { errorCodes } from '../../src/graphql/errors';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import setupDatabase from '../../src/databaseSetup/collectionsAndIndexes';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
import {
    WRITE_LOG,
    GET_LOGS,
    LOG_TYPE,
    LOG_ACTION,
    userTypes
} from 'itmat-commons';
import { async } from 'q';

let app;
let mongodb;
let admin;
let user;
let mongoConnection;
let mongoClient;

const SEED_STANDARD_USER_USERNAME = 'standardUser';
const SEED_STANDARD_USER_EMAIL = 'standard@example.com';
const TEMP_USER_TEST_EMAIL = process.env.TEST_RECEIVER_EMAIL_ADDR || SEED_STANDARD_USER_EMAIL;
const SKIP_EMAIL_TEST = process.env.SKIP_EMAIL_TEST === 'true';


afterAll(async () => {
    await db.closeConnection();
    await mongoConnection?.close();
    await mongodb.stop();

    /* claer all mocks */
    jest.clearAllMocks();
});

beforeAll(async () => { // eslint-disable-line no-undef
    /* Creating a in-memory MongoDB instance for testing */
    mongodb = new MongoMemoryServer();
    const connectionString = await mongodb.getUri();
    const database = await mongodb.getDbName();
    await setupDatabase(connectionString, database);
    
    /* Wiring up the backend server */
    config.database.mongo_url = connectionString;
    config.database.database = database;
    const res = await db.connect(config.database, MongoClient.connect);
    const router = new Router(config);
    
    /* Connect mongo client (for test setup later / retrieve info later) */
    mongoConnection = await MongoClient.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    mongoClient = mongoConnection.db(database);
    
    /* Connecting clients for testing later */
    app = router.getApp();
    admin = request.agent(app);
    user = request.agent(app);
    await connectAdmin(admin);
    await connectUser(user);
    
    /* Mock Date for testing */
    jest.spyOn(Date, 'now').mockImplementation(() => 1591134065000);
});

describe('WRITING LOG', () => {
    beforeAll(async () => {
        /* setup: first retrieve the generated user id */
    
    });
    
    test('Write log', async () => {
        const res = await admin.post('/graphql').send({
            query: print(WRITE_LOG),
            variables: {
                requesterId: 'vvid',
                requesterName: 'testuser',
                requesterType: userTypes.ADMIN,
                action: LOG_ACTION.DELETE_FILE,
                actionData: {'fileName': 'test.txt'}
            }
        });
        expect(res.status).toBe(200);
        expect(res.body.errors).toBeUndefined();
    }, 30000);

});
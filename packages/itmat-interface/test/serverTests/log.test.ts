import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import setupDatabase from '../../src/databaseSetup/collectionsAndIndexes';
import config from '../../config/config.sample.json';
import { errorCodes } from '../../src/graphql/errors';
import {
    WRITE_LOG,
    LOG_ACTION,
    userTypes,
    LOG_STATUS,
    GET_LOGS
} from 'itmat-commons';

let app;
let mongodb;
let admin;
let user;
let mongoConnection;
let mongoClient;

// const SEED_STANDARD_USER_USERNAME = 'standardUser';
// const SEED_STANDARD_USER_EMAIL = 'standard@example.com';
// const TEMP_USER_TEST_EMAIL = process.env.TEST_RECEIVER_EMAIL_ADDR || SEED_STANDARD_USER_EMAIL;
// const SKIP_EMAIL_TEST = process.env.SKIP_EMAIL_TEST === 'true';


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
    await db.connect(config.database, MongoClient.connect);
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

describe('LOG API', () => {
    describe ('Write logs', () => {
        test('Write log (Login)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(WRITE_LOG),
                variables: {
                    id: 'NA',
                    requesterId: 'NA',
                    requesterName: 'NA',
                    requesterType: userTypes.ADMIN,
                    action: LOG_ACTION.LOGIN_USER,
                    actionData: {userName: 'admin'},
                    status: LOG_STATUS.SUCCESS
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            db.collections!.log_collection.deleteOne({requesterId: 'NA'});
        }, 30000);
    });

    describe('Get logs', () => {
        beforeAll(async() => {
            // write initial data for testing
            const logSample = [{
                id: 'id001',
                requesterId: 'test_id1',
                requesterName: 'test_user1',
                requesterType: userTypes.STANDARD,
                action: LOG_ACTION.UPLOAD_FILE,
                actionData: {
                    fileName: 'new_file.txt',
                },
                time: 100000001,
                status: LOG_STATUS.SUCCESS
            }];
            await db.collections!.log_collection.insertMany(logSample);
        });

        afterAll(async() => {
            await mongoClient.collection(config.database.collections.log_collection).remove({});
        });

        test('GET log (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(GET_LOGS),
                variables: {
                    requesterId: 'test_id1'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.getLogs).toEqual([{
                id: 'id001',
                requesterId: 'test_id1',
                requesterName: 'test_user1',
                requesterType: userTypes.STANDARD,
                action: LOG_ACTION.UPLOAD_FILE,
                actionData: {
                    fileName: 'new_file.txt',
                },
                time: 100000001,
                status: LOG_STATUS.SUCCESS
            }]);
        }, 30000);

        test('GET log (user) should fail', async () => {
            const res = await user.post('/graphql').send({
                query: print(GET_LOGS),
                variables: {
                    requesterId: 'test_id1'
                }
            });
            console.log(res.body);
            console.log(res.body.data.getLogs);
            expect(res.status).toBe(200);
            console.log(res.body.errors);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
        }, 30000);
    });

});

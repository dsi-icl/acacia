// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from 'itmat-setup';
import config from '../../config/config.sample.json';
import { errorCodes } from '../../src/graphql/errors';
import * as mfa from '../../src/utils/mfa';
import {
    LOG_ACTION,
    userTypes,
    LOG_STATUS,
    GET_LOGS,
    LOG_TYPE,
    LOGIN,
    IUser,
    DELETE_USER,
    USER_AGENT
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
    mongodb = await MongoMemoryServer.create();
    const connectionString = mongodb.getUri();
    const database = mongodb.instanceInfo.dbName;
    await setupDatabase(connectionString, database);

    /* Wiring up the backend server */
    config.database.mongo_url = connectionString;
    config.database.database = database;
    await db.connect(config.database, MongoClient.connect as any);
    const router = new Router(config);

    /* Connect mongo client (for test setup later / retrieve info later) */
    mongoConnection = await MongoClient.connect(connectionString);
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
    describe('Write logs', () => {
        test('Write log (Login)', async () => {
            const userSecret = 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA';
            const newUser: IUser = {
                id: 'testuser0',
                username: 'test_user',
                email: 'test@test.com',
                firstname: 'test',
                lastname: 'user',
                organisation: 'organisation_system',
                type: userTypes.ADMIN,
                description: 'I am an test user.',
                emailNotificationsActivated: true,
                deleted: null,
                password: '$2b$04$ps9ownz6PqJFD/LExsmgR.ZLk11zhtRdcpUwypWVfWJ4ZW6/Zzok2',
                otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                resetPasswordRequests: [],
                createdAt: 1591134065000,
                expiredAt: 2501134065000
            };
            await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);
            const newloggedoutuser = request.agent(app);
            const otp = mfa.generateTOTP(userSecret).toString();
            const res = await newloggedoutuser.post('/graphql').set('Content-type', 'application/json').send({
                query: print(LOGIN),
                variables: {
                    username: 'test_user',
                    password: 'admin',
                    totp: otp
                }
            });
            expect(res.status).toBe(200);
            const findLogInMongo = await db.collections!.log_collection.find({}).toArray();
            const lastLog = findLogInMongo.pop();
            expect(lastLog.requesterName).toEqual('test_user');
            expect(lastLog.requesterType).toEqual(userTypes.ADMIN);
            expect(lastLog.logType).toEqual(LOG_TYPE.REQUEST_LOG);
            expect(lastLog.actionType).toEqual(LOG_ACTION.login);
            expect(JSON.parse(lastLog.actionData)).toEqual({
                username: 'test_user',
            });
            expect(lastLog.status).toEqual(LOG_STATUS.SUCCESS);
            expect(lastLog.errors).toEqual('');

            await admin.post('/graphql').send(
                {
                    query: print(DELETE_USER),
                    variables: {
                        userId: newUser.id
                    }
                }
            );
        }, 30000);
    });

    describe('Get logs', () => {
        beforeAll(async () => {
            // write initial data for testing
            const logSample = [{
                id: '001',
                requesterName: userTypes.SYSTEM,
                requesterType: userTypes.SYSTEM,
                logType: LOG_TYPE.SYSTEM_LOG,
                userAgent: USER_AGENT.MOZILLA,
                actionType: LOG_ACTION.startSERVER,
                actionData: JSON.stringify({}),
                time: 100000000,
                status: LOG_STATUS.SUCCESS,
                error: ''
            }];
            await db.collections!.log_collection.insertMany(logSample);
        });

        afterAll(async () => {
            await mongoClient.collection(config.database.collections.log_collection).deleteMany({});
        });

        test('GET log (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(GET_LOGS),
                variables: {
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.getLogs.length).toBeGreaterThanOrEqual(1);
        }, 30000);

        test('GET log (user) should fail', async () => {
            const res = await user.post('/graphql').send({
                query: print(GET_LOGS),
                variables: {
                    requesterId: 'test_id1'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
        }, 30000);
    });
});

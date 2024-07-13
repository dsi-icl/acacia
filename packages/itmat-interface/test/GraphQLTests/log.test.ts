// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { v4 as uuid } from 'uuid';
import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
import { errorCodes, generateTOTP } from '@itmat-broker/itmat-cores';
import { GET_LOGS, LOGIN, DELETE_USER } from '@itmat-broker/itmat-models';
import { enumUserTypes, IUser, ILogEntry, enumEventType, enumAPIResolver, enumEventStatus, ILog } from '@itmat-broker/itmat-types';
import { Express } from 'express';

let app: Express;
let mongodb: MongoMemoryServer;
let admin: request.SuperTest<request.Test>;
let user: request.SuperTest<request.Test>;
let mongoConnection: MongoClient;
let mongoClient: Db;

afterAll(async () => {
    await db.closeConnection();
    await mongoConnection?.close();
    await mongodb.stop();

    /* claer all mocks */
    jest.clearAllMocks();
});

beforeAll(async () => { // eslint-disable-line no-undef
    /* Creating a in-memory MongoDB instance for testing */
    const dbName = uuid();
    mongodb = await MongoMemoryServer.create({ instance: { dbName } });
    const connectionString = mongodb.getUri();
    await setupDatabase(connectionString, dbName);

    /* Wiring up the backend server */
    config.database.mongo_url = connectionString;
    config.database.database = dbName;
    await db.connect(config.database, MongoClient);
    const router = new Router(config);
    await router.init();

    /* Connect mongo client (for test setup later / retrieve info later) */
    mongoConnection = await MongoClient.connect(connectionString);
    mongoClient = mongoConnection.db(dbName);

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
                type: enumUserTypes.ADMIN,
                description: 'I am an test user.',
                emailNotificationsActivated: true,
                emailNotificationsStatus: { expiringNotification: false },
                password: '$2b$04$ps9ownz6PqJFD/LExsmgR.ZLk11zhtRdcpUwypWVfWJ4ZW6/Zzok2',
                otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                resetPasswordRequests: [],
                expiredAt: 2501134065000,
                life: {
                    createdTime: 1591134065000,
                    createdUserId: 'admin',
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            };
            await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
            const newloggedoutuser = request.agent(app);
            const otp = generateTOTP(userSecret).toString();
            const res = await newloggedoutuser.post('/graphql').set('Content-type', 'application/json').send({
                query: print(LOGIN),
                variables: {
                    username: 'test_user',
                    password: 'admin',
                    totp: otp
                }
            });
            expect(res.status).toBe(200);
            const findLogInMongo = await db.collections.log_collection.find({}).toArray();
            const lastLog = findLogInMongo.pop();
            expect(lastLog).toBeDefined();
            expect(lastLog.requester).toEqual('test_user');
            expect(lastLog.type).toEqual(enumEventType.API_LOG);
            expect(lastLog.apiResolver).toEqual(enumAPIResolver.GraphQL);
            expect(lastLog.event).toEqual('login');
            expect(lastLog.status).toEqual(enumEventStatus.SUCCESS);
            expect(lastLog.errors).toBe(null);

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
            const logSample: ILog = [{
                id: uuid(),
                requester: 'test_id1',
                type: enumEventType.API_LOG,
                apiResolver: enumAPIResolver.GraphQL,
                event: 'test_event1',
                parameters: {},
                status: enumEventStatus.SUCCESS,
                errors: null,
                timeConsumed: 100,
                life: {
                    createdTime: Date.now(),
                    createdUser: 'SYSTEMAGENT',
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            }, {
                id: uuid(),
                requester: 'test_id2',
                type: enumEventType.API_LOG,
                apiResolver: enumAPIResolver.GraphQL,
                event: 'test_event2',
                parameters: {},
                status: enumEventStatus.FAIL,
                errors: 'test_error',
                timeConsumed: 200,
                life: {
                    createdTime: Date.now(),
                    createdUser: 'SYSTEMAGENT',
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            }];
            await db.collections.log_collection.insertMany(logSample);
        });

        afterAll(async () => {
            await mongoClient.collection<ILogEntry>(config.database.collections.log_collection).deleteMany({});
        });

        test('GET log (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(GET_LOGS),
                variables: {
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.getLogs.length).toBeGreaterThanOrEqual(2);
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

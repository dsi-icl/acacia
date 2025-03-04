/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck


import { MongoMemoryServer } from 'mongodb-memory-server';
import { db } from '../../src/database/database';
import { objStore } from '../../src/objStore/objStore';
import request from 'supertest';
import { connectAdmin, connectUser } from './_loginHelper';
import { Router } from '../../src/server/router';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
import { Express } from 'express';
import { IUser, enumUserTypes, LXDInstanceTypeEnum, enumAppType, enumOpeType, enumInstanceStatus } from '@itmat-broker/itmat-types';
import { Db, MongoClient } from 'mongodb';
import {JobCore, UserCore} from '@itmat-broker/itmat-cores';


jest.mock('nodemailer', () => {
    const { TEST_SMTP_CRED, TEST_SMTP_USERNAME } = process.env;
    if (!TEST_SMTP_CRED || !TEST_SMTP_USERNAME || !config?.nodemailer?.auth?.pass || !config?.nodemailer?.auth?.user)
        return {
            createTransport: jest.fn().mockImplementation(() => ({
                sendMail: jest.fn()
            }))
        };
    return jest.requireActual('nodemailer');
});


if (global.hasMinio) { // eslint-disable-line no-undef
    let app: Express;
    let mongodb: MongoMemoryServer;
    let admin: request.SuperTest<request.Test>;
    let user: request.SuperTest<request.Test>;
    let mongoConnection: MongoClient;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mongoClient: Db;
    let adminProfile: IUser;
    let userProfile: IUser;

    const setupDatabaseAndApp = async () => {
        const dbName = uuid();
        mongodb = await MongoMemoryServer.create({ instance: { dbName } });
        const connectionString = mongodb.getUri();
        await setupDatabase(connectionString, dbName);

        config.objectStore.port = global.minioContainerPort;
        config.database.mongo_url = connectionString;
        config.database.database = dbName;

        await db.connect(config.database, MongoClient);

        await objStore.connect(config.objectStore);

        // Initialize the router and application
        const router = new Router(config);
        await router.init();

        mongoConnection = await MongoClient.connect(connectionString);
        mongoClient = mongoConnection.db(dbName);

        app = router.getApp();
        admin = request.agent(app);
        user = request.agent(app);
        await connectAdmin(admin);
        await connectUser(user);

        // Connect admin and user (mock login)
        const users = await db.collections.users_collection.find({}).toArray();
        adminProfile = users.find(el => el.type === enumUserTypes.ADMIN);
        userProfile = users.find(el => el.type === enumUserTypes.STANDARD);
    };


    let userCoreMock: jest.SpyInstance;
    let jobCoreMock: jest.SpyInstance;

    beforeAll(async () => {
        await setupDatabaseAndApp();

        // Mock specific methods inside UserCore and JobCore
        userCoreMock = jest.spyOn(UserCore.prototype, 'issueSystemAccessToken').mockResolvedValue({ accessToken: 'mocked-token' });
        jobCoreMock = jest.spyOn(JobCore.prototype, 'createJob').mockResolvedValue(true);
    });

    afterAll(async () => {
        await db.closeConnection();
        await mongoConnection.close();
        await mongodb.stop();
        userCoreMock.mockRestore();
        jobCoreMock.mockRestore();
    });
    afterEach(async () => {
        await db.collections.instance_collection.deleteMany({}); // Clean up all instances after each test
    });

    describe('tRPC Instance APIs', () => {

        describe('createInstance', () => {
            test('Should create an instance successfully', async () => {
                const response = await user.post('/trpc/instance.createInstance').send({
                    name: 'test-instance',
                    type: LXDInstanceTypeEnum.CONTAINER,
                    appType: enumAppType.JUPYTER,
                    cpuLimit: 2,
                    memoryLimit: '4GB',
                    diskLimit: '10GB',
                    lifeSpan: 3600
                });


                expect(response.status).toBe(200);
                expect(response.body.result.data.name).toBe('test-instance');

                const instance = await db.collections.instance_collection.findOne({ name: 'test-instance' });
                expect(instance).toBeDefined();
                expect(instance?.name).toBe('test-instance');
            });

            test('Should throw error when user is not logged in', async () => {
                const response = await request(app).post('/trpc/instance.createInstance').send({
                    name: 'test-instance',
                    type: LXDInstanceTypeEnum.CONTAINER,
                    appType: enumAppType.JUPYTER,
                    lifeSpan: 3600
                });

                expect(response.status).toBe(400); // User is not authenticated
                expect(response.body.error).toBeDefined();
            });
        });

        describe('getQuotaAndFlavors', () => {
            test('Should return quota and flavors for logged-in user', async () => {

                const response = await user.get('/trpc/instance.getQuotaAndFlavors').send();
                expect(response.status).toBe(200);
                expect(response.body.result?.data?.userQuota).toBeDefined();
                expect(response.body.result?.data?.userFlavors).toBeDefined();
            });

            test('Should throw error when user is not logged in', async () => {
                const response = await request(app).get('/trpc/instance.getQuotaAndFlavors').send();
                expect(response.status).toBe(400);
                expect(response.body.error).toBeDefined();
                expect(response.body.error.message).toBe('User must be authenticated.');
            });
        });

        describe('startStopInstance', () => {
            test('Should start an instance successfully', async () => {
                const instanceId = uuid();
                await db.collections.instance_collection.insertOne({
                    id: instanceId,
                    name: 'test-instance',
                    type: LXDInstanceTypeEnum.CONTAINER,
                    appType: enumAppType.JUPYTER,
                    userId: userProfile.id,
                    status: enumInstanceStatus.PENDING
                });

                const response = await user.post('/trpc/instance.startStopInstance').send({
                    instanceId,
                    action: enumOpeType.START
                });

                expect(response.status).toBe(200);

                const instance = await db.collections.instance_collection.findOne({ id: instanceId });
                expect(instance?.status).toBe(enumInstanceStatus.STARTING);
            });

            test('Should return error when unauthorized user tries to start an instance', async () => {
                // Step 1: Create an instance assigned to another user
                const instanceId = uuid(); // Generate a unique instance ID
                await db.collections.instance_collection.insertOne({
                    id: instanceId,
                    name: 'test-instance',
                    type: LXDInstanceTypeEnum.CONTAINER,
                    appType: enumAppType.JUPYTER,
                    userId: 'some-other-user-id', // Assign this instance to another user (not the logged-in user)
                    status: enumInstanceStatus.PENDING // Set initial status to PENDING
                });

                // Step 2: Make the request without a logged-in user (using `request(app)` directly)
                const response = await request(app).post('/trpc/instance.startStopInstance').send({
                    instanceId: instanceId,
                    action: enumOpeType.START
                });

                // Step 3: Ensure the user gets a 400 Forbidden error since they don't own the instance
                expect(response.status).toBe(400); // Expecting a Forbidden status code
                expect(response.body.error).toBeDefined(); // Ensure the response contains an error
            });
        });

        describe('restartInstance', () => {
            test('Should restart an instance successfully', async () => {
                const instanceId = uuid();
                await db.collections.instance_collection.insertOne({
                    id: instanceId,
                    name: 'test-instance',
                    type: LXDInstanceTypeEnum.CONTAINER,
                    appType: enumAppType.JUPYTER,
                    userId: userProfile.id,
                    status: enumInstanceStatus.STOPPED
                });

                const response = await user.post('/trpc/instance.restartInstance').send({
                    instanceId,
                    lifeSpan: 7200
                });

                expect(response.status).toBe(200);

                const instance = await db.collections.instance_collection.findOne({ id: instanceId });
                expect(instance?.status).toBe(enumInstanceStatus.STARTING);
                expect(instance?.lifeSpan).toBe(7200);
            });
        });

        describe('getInstances', () => {
            test('Logged-in user should be able to retrieve their own instances', async () => {
                // Insert an instance for the logged-in user
                await db.collections.instance_collection.insertOne({
                    id: uuid(),
                    name: 'user-instance',
                    type: LXDInstanceTypeEnum.CONTAINER,
                    appType: enumAppType.JUPYTER,
                    userId: userProfile.id, // Belongs to the logged-in user
                    status: enumInstanceStatus.RUNNING,
                    config: {
                        'limits.cpu': '2',
                        'limits.memory': '4GB'
                    }
                });

                // The logged-in user should retrieve their own instance
                const response = await user.get('/trpc/instance.getInstances').send();
                expect(response.status).toBe(200);
                expect(response.body.result.data).toHaveLength(1); // Only the user's instance
                expect(response.body.result.data[0].name).toBe('user-instance');
            });

            test('Non-logged-in user should not be able to retrieve any instances', async () => {
                // Try to retrieve instances without being logged in
                const response = await request(app).get('/trpc/instance.getInstances').send();

                // Ensure the user gets a 400 Unauthorized error
                expect(response.status).toBe(400); // Unauthorized
                expect(response.body.error).toBeDefined();
                expect(response.body.error.message).toBe('Insufficient permissions.');
            });
        });

        describe('deleteInstance', () => {
            test('Admin should delete an instance successfully', async () => {
                const instanceId = uuid();
                await db.collections.instance_collection.insertOne({
                    id: instanceId,
                    name: 'instance-to-delete',
                    type: LXDInstanceTypeEnum.CONTAINER,
                    appType: enumAppType.JUPYTER,
                    userId: adminProfile.id,
                    status: enumInstanceStatus.RUNNING
                });

                const response = await admin.post('/trpc/instance.deleteInstance').send({
                    instanceId
                });

                expect(response.status).toBe(200);

                const instance = await db.collections.instance_collection.findOne({ id: instanceId });
                expect(instance?.status).toBe(enumInstanceStatus.DELETED);
            });
        });

    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}
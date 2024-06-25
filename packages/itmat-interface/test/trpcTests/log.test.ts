/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import { connectAdmin, connectUser } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import config from '../../config/config.sample.json';
import { enumCoreErrors, enumEventStatus } from '@itmat-broker/itmat-types';
import { Express } from 'express';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import { encodeQueryParams } from './helper';
import path from 'path';

if (global.hasMinio) {
    let app: Express;
    let mongodb: MongoMemoryServer;
    let admin: request.SuperTest<request.Test>;
    let user: request.SuperTest<request.Test>;
    let mongoConnection: MongoClient;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    afterEach(async () => {
        await db.collections.log_collection.deleteMany({});
    });

    describe('tRPC log APIs', () => {
        test('Write log (query)', async () => {
            // query API
            const paramteres = {
            };
            await user.get('/trpc/study.getStudies?input=' + encodeQueryParams(paramteres))
                .query({});
            const log = await db.collections.log_collection.find({}).toArray();
            // start server; two login logs, and this new log
            expect(log).toHaveLength(4);
            expect(log[3].event).toBe('study.getStudies');
        });
        test('Write log (mutation)', async () => {
            const filePath = path.join(__dirname, '../filesForTests/dsi.jpeg');
            const request = admin.post('/trpc/study.createStudy')
                .attach('profile', filePath)
                .field('name', 'Test Study')
                .field('description', '');
            await request;
            const log = await db.collections.log_collection.find({}).toArray();
            expect(log).toHaveLength(1);
            expect(log[0].event).toBe('study.createStudy');
        });
        test('Write log (with errors)', async () => {
            const filePath = path.join(__dirname, '../filesForTests/dsi.jpeg');
            const request = user.post('/trpc/study.createStudy')
                .attach('profile', filePath)
                .field('name', 'Test Study')
                .field('description', '');
            await request;
            const log = await db.collections.log_collection.find({}).toArray();
            expect(log).toHaveLength(1);
            expect(log[0].event).toBe('study.createStudy');
            expect(log[0].status).toBe(enumEventStatus.FAIL);
            expect(log[0].errors).toBe('Only admin can create a study.');
        });
        test('Get log (admin)', async () => {
            const filePath = path.join(__dirname, '../filesForTests/dsi.jpeg');
            const request = admin.post('/trpc/study.createStudy')
                .attach('profile', filePath)
                .field('name', 'Test Study')
                .field('description', '');
            await request;

            const paramteres = {
            };
            const response = await admin.get('/trpc/log.getLogs?input=' + encodeQueryParams(paramteres))
                .query({});
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(1);
        });
        test('Get log (user)', async () => {
            const paramteres = {
            };
            const response = await user.get('/trpc/log.getLogs?input=' + encodeQueryParams(paramteres))
                .query({});
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}
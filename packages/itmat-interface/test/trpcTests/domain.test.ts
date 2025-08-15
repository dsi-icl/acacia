/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import { objStore } from '../../src/objStore/objStore';
import { connectAdmin, connectUser } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import config from '../../config/config.sample.json';
import { IDomain, enumCoreErrors } from '@itmat-broker/itmat-types';
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
    let test_domain: IDomain;

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
        config.objectStore.port = (global as any).minioContainerPort;
        config.database.mongo_url = connectionString;
        config.database.database = dbName;
        await db.connect(config.database, MongoClient);
        await objStore.connect(config.objectStore);
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

        test_domain = {
            id: 'test_domain',
            domainPath: 'test_domain',
            name: 'test',
            logo: 'test_logo',
            color: '#000000',
            life: {
                createdTime: 1591134065000,
                createdUser: 'admin',
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };
        await db.collections.domains_collection.insertOne(test_domain);
    });

    afterEach(async () => {
        await db.collections.domains_collection.deleteMany({});
        await db.collections.domains_collection.insertOne(test_domain);
    });

    describe('tRPC domain APIs', () => {
        test('Get domains (admin)', async () => {
            // query API
            const paramteres = {
            };
            const response = await admin.get('/trpc/domain.getDomains?input=' + encodeQueryParams(paramteres))
                .query({});
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(1);
            expect(response.body.result.data[0].domainPath).toBe('test_domain');
        });
        test('Get domains (user)', async () => {
            // query API
            const paramteres = {
            };
            const response = await user.get('/trpc/domain.getDomains?input=' + encodeQueryParams(paramteres))
                .query({});
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Create domain (admin)', async () => {
            const filePath = path.join(__dirname, '../filesForTests/dsi.jpeg');
            const response = await admin.post('/trpc/domain.createDomain')
                .attach('logo', filePath)
                .field('domainName', 'new_test')
                .field('domainPath', 'new_test_domain')
                .field('color', '#000000');
            expect(response.status).toBe(200);
            expect(response.body.result.data.domainPath).toBe('new_test_domain');
        });
        test('Create domain (user)', async () => {
            const filePath = path.join(__dirname, '../filesForTests/dsi.jpeg');
            const response = await user.post('/trpc/domain.createDomain')
                .attach('logo', filePath)
                .field('domainName', 'new_test')
                .field('domainPath', 'new_test_domain')
                .field('color', '#000000');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Create domain on existing domain path', async () => {
            const filePath = path.join(__dirname, '../filesForTests/dsi.jpeg');
            const response = await admin.post('/trpc/domain.createDomain')
                .attach('logo', filePath)
                .field('domainName', 'new_test')
                .field('domainPath', 'test_domain')
                .field('color', '#000000');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Domain already exists.');
        });
        test('Edit domain (admin)', async () => {
            const response = await admin.post('/trpc/domain.editDomain')
                .field('domainId', 'test_domain')
                .field('domainName', 'new_test')
                .field('color', '#000000');
            expect(response.status).toBe(200);
            expect(response.body.result.data.successful).toBe(true);
        });
        test('Edit domain (user)', async () => {
            const response = await user.post('/trpc/domain.editDomain')
                .field('domainId', 'test_domain')
                .field('domainName', 'new_test')
                .field('color', '#000000');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Delete domain (admin)', async () => {
            const response = await admin.post('/trpc/domain.deleteDomain')
                .field('domainId', 'test_domain');
            expect(response.status).toBe(200);
            expect(response.body.result.data.successful).toBe(true);
            const domain = await db.collections.domains_collection.findOne({ id: 'test_domain' });
            expect(domain.life.deletedTime).not.toBe(null);
        });
        test('Delete domain (user)', async () => {
            const response = await user.post('/trpc/domain.deleteDomain')
                .field('domainId', 'test_domain');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Delete non-existing domain', async () => {
            const response = await admin.post('/trpc/domain.deleteDomain')
                .field('domainId', 'non_existing_domain');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Domain does not exist.');
        });
    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}
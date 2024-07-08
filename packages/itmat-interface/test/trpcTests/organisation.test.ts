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
import { objStore } from '../../src/objStore/objStore';
import { enumCoreErrors } from '@itmat-broker/itmat-types';
import { Express } from 'express';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import { encodeQueryParams } from './helper';
import path from 'path';
import { seedOrganisations } from 'packages/itmat-setup/src/databaseSetup/seed/organisations';

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
    });

    afterEach(async () => {
        await db.collections.organisations_collection.deleteMany({});
        await db.collections.organisations_collection.insertMany(seedOrganisations);
        await db.collections.files_collection.deleteMany({});
    });

    describe('tRPC organisation APIs', () => {
        test('Get organisations (admin)', async () => {
            const paramteres = {
            };
            const response = await admin.get('/trpc/organisation.getOrganisations?input=' + encodeQueryParams(paramteres))
                .query({});
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(2);
        });
        test('Get organisations with organisationId (admin)', async () => {
            const paramteres = {
                organisationId: 'organisation_system'
            };
            const response = await admin.get('/trpc/organisation.getOrganisations?input=' + encodeQueryParams(paramteres))
                .query({});
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(1);
            expect(response.body.result.data[0].id).toBe('organisation_system');
        });
        test('Get organisations (user)', async () => {
            const paramteres = {
            };
            const response = await user.get('/trpc/organisation.getOrganisations?input=' + encodeQueryParams(paramteres))
                .query({});
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(2);
        });
        test('Get organisations with organisationId (user)', async () => {
            const paramteres = {
                organisationId: 'organisation_system'
            };
            const response = await user.get('/trpc/organisation.getOrganisations?input=' + encodeQueryParams(paramteres))
                .query({});
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(1);
            expect(response.body.result.data[0].id).toBe('organisation_system');
        });
        test('Create organisation (admin)', async () => {
            const response = await admin.post('/trpc/organisation.createOrganisation')
                .field('name', 'test')
                .field('shortname', 'tst');
            expect(response.status).toBe(200);
            expect(response.body.result.data.name).toBe('test');
            expect(response.body.result.data.shortname).toBe('tst');
            const orgs = await db.collections.organisations_collection.find({}).toArray();
            expect(orgs).toHaveLength(3);
        });
        test('Create organisation (user)', async () => {
            const response = await user.post('/trpc/organisation.createOrganisation')
                .field('name', 'test')
                .field('shortname', 'tst');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Create organisation (admin) with files', async () => {
            const filePath = path.join(__dirname, '../filesForTests/dsi.jpeg');
            const response = await admin.post('/trpc/organisation.createOrganisation')
                .attach('profile', filePath)
                .field('name', 'test')
                .field('shortname', 'tst');
            expect(response.status).toBe(200);
            expect(response.body.result.data.name).toBe('test');
            expect(response.body.result.data.shortname).toBe('tst');
            expect(response.body.result.data.profile).toBeDefined();
            const orgs = await db.collections.organisations_collection.find({}).toArray();
            expect(orgs).toHaveLength(3);
            const files = await db.collections.files_collection.find({}).toArray();
            expect(files).toHaveLength(1);
            expect(files[0].id).toBe(response.body.result.data.profile);
        });
        test('Create organisation (admin) duplicate name', async () => {
            const response = await admin.post('/trpc/organisation.createOrganisation')
                .field('name', 'System')
                .field('shortname', 'tst');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Organisation already exists.');
        });
        test('Edit organisation (admin)', async () => {
            const response = await admin.post('/trpc/organisation.editOrganisation')
                .field('organisationId', 'organisation_system')
                .field('name', 'test')
                .field('shortname', 'tst');
            expect(response.status).toBe(200);
            expect(response.body.result.data.successful).toBe(true);
            const org = await db.collections.organisations_collection.findOne({ id: 'organisation_system' });
            expect(org.name).toBe('test');
        });
        test('Edit organisation (user)', async () => {
            const response = await user.post('/trpc/organisation.editOrganisation')
                .field('organisationId', 'organisation_system')
                .field('name', 'test')
                .field('shortname', 'tst');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Edit organisation (admin) duplicate name', async () => {
            const response = await admin.post('/trpc/organisation.editOrganisation')
                .field('organisationId', 'organisation_system')
                .field('name', 'user')
                .field('shortname', 'tst');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Organisation already exists.');
        });
        test('Delete organisation (admin)', async () => {
            const response = await admin.post('/trpc/organisation.deleteOrganisation')
                .field('organisationId', 'organisation_system');
            expect(response.status).toBe(200);
            expect(response.body.result.data.successful).toBe(true);
            const org = await db.collections.organisations_collection.findOne({ id: 'organisation_system' });
            expect(org.life.deletedTime).toBeDefined();
        });
        test('Delete organisation (user)', async () => {
            const response = await user.post('/trpc/organisation.deleteOrganisation')
                .field('organisationId', 'organisation_system');
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}
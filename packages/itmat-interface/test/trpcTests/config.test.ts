/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { MongoMemoryServer } from 'mongodb-memory-server';
import { db } from '../../src/database/database';
import { Express } from 'express';
import { objStore } from '../../src/objStore/objStore';
import request from 'supertest';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { Router } from '../../src/server/router';
import { MongoClient } from 'mongodb';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
import { enumUserTypes, enumStudyRoles, enumCoreErrors, enumConfigType } from '@itmat-broker/itmat-types';
import { encodeQueryParams } from './helper';
import { seedConfigs } from 'packages/itmat-setup/src/databaseSetup/seed/config';

if (global.hasMinio) {
    let app: Express;
    let mongodb: MongoMemoryServer;
    let admin: request.SuperTest<request.Test>;
    let user: request.SuperTest<request.Test>;
    let authorisedUser: request.SuperTest<request.Test>;
    let mongoConnection: MongoClient;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mongoClient: Db;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let adminProfile;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let userProfile;
    let authorisedUserProfile;
    let study;
    let fullPermissionRole: IRole;

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

        // add the root node for each user
        const users = await db.collections.users_collection.find({}).toArray();
        adminProfile = users.filter(el => el.type === enumUserTypes.ADMIN)[0];
        userProfile = users.filter(el => el.type === enumUserTypes.STANDARD)[0];

        const username = uuid();
        authorisedUserProfile = {
            username,
            type: enumUserTypes.STANDARD,
            firstname: `${username}_firstname`,
            lastname: `${username}_lastname`,
            password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
            otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
            email: `${username}@example.com`,
            description: 'I am a new user.',
            emailNotificationsActivated: true,
            organisation: 'organisation_system',
            id: `new_user_id_${username}`,
            emailNotificationsStatus: { expiringNotification: false },
            resetPasswordRequests: [],
            expiredAt: 1991134065000,
            life: {
                createdTime: 1591134065000,
                createdUser: 'admin',
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };
        await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(authorisedUserProfile);
        authorisedUser = request.agent(app);
        await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);
    });

    beforeEach(async () => {
        study = {
            id: uuid(),
            name: 'Test Study',
            currentDataVersion: -1, // index; dataVersions[currentDataVersion] gives current version; // -1 if no data
            dataVersions: [],
            description: null,
            profile: null,
            webLayout: [],
            life: {
                createdTime: 0,
                createdUser: enumUserTypes.SYSTEM,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };
        await db.collections.studies_collection.insertOne(study);
        fullPermissionRole = {
            id: 'full_permission_role_id',
            studyId: study.id,
            name: 'Full Permissison Role',
            description: '',
            // data permissions for studyId
            dataPermissions: [{
                fields: ['^1.*$'],
                dataProperties: {
                },
                permission: parseInt('111', 2),
                includeUnVersioned: true
            }],
            studyRole: enumStudyRoles.STUDY_MANAGER,
            users: [authorisedUserProfile.id],
            groups: [],
            life: {
                createdTime: 0,
                createdUser: 'admin',
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };
        await db.collections.roles_collection.insertOne(fullPermissionRole);
    });

    afterEach(async () => {
        await db.collections.studies_collection.deleteMany({});
        await db.collections.field_dictionary_collection.deleteMany({});
        await db.collections.data_collection.deleteMany({});
        await db.collections.roles_collection.deleteMany({});
        await db.collections.files_collection.deleteMany({});
        await db.collections.cache_collection.deleteMany({});
        await db.collections.configs_collection.deleteMany({});
        await db.collections.configs_collection.insertMany(seedConfigs);
    });

    describe('tRPC config APIs', () => {
        test('Get system config (admin)', async () => {
            const paramteres = {
                configType: enumConfigType.SYSTEMCONFIG,
                key: null,
                useDefault: false
            };
            const response = await admin.get('/trpc/config.getConfig?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data.id).toBe('root_system_config_protected');
        });
        test('Get system config default setting (admin)', async () => {
            const paramteres = {
                configType: enumConfigType.SYSTEMCONFIG,
                key: null,
                useDefault: true
            };
            const response = await admin.get('/trpc/config.getConfig?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data.properties.defaultMaximumFileSize).toBe(1 * 1024 * 1024 * 1024);
        });
        test('Edit system config (admin)', async () => {
            const response = await admin.post('/trpc/config.editConfig')
                .send({
                    configType: enumConfigType.SYSTEMCONFIG,
                    key: null,
                    properties: {
                        id: 'root_system_config_protected',
                        type: enumConfigType.SYSTEMCONFIG,
                        key: null,
                        id: 'root_system_config',
                        life: {
                            createdTime: Date.now(),
                            createdUser: 'SYSTEM',
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {},
                        defaultBackgroundColor: '#FFFFFF',
                        defaultMaximumFileSize: 1 * 1024 * 1024 * 1024, // 1 GB
                        defaultFileBucketId: 'system',
                        defaultProfileBucketId: 'profile',
                        logoLink: null,
                        logoSize: ['24px', '24px'],
                        archiveAddress: '',
                        defaultEventTimeConsumptionBar: [50, 100],
                        defaultUserExpireDays: 120
                    }
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data.successful).toBe(true);
            const config = await db.collections.configs_collection.findOne({ 'type': enumConfigType.SYSTEMCONFIG, 'key': null, 'life.deletedTime': null });
            expect(config).toBeDefined();
            expect(config.properties.defaultUserExpireDays).toBe(120);
        });
        test('Edit system config (user)', async () => {
            const response = await user.post('/trpc/config.editConfig')
                .send({
                    configType: enumConfigType.SYSTEMCONFIG,
                    key: null,
                    properties: {
                        id: 'root_system_config_protected',
                        type: enumConfigType.SYSTEMCONFIG,
                        key: null,
                        id: 'root_system_config',
                        life: {
                            createdTime: Date.now(),
                            createdUser: 'SYSTEM',
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {},
                        defaultBackgroundColor: '#FFFFFF',
                        defaultMaximumFileSize: 1 * 1024 * 1024 * 1024, // 1 GB
                        defaultFileBucketId: 'system',
                        defaultProfileBucketId: 'profile',
                        logoLink: null,
                        logoSize: ['24px', '24px'],
                        archiveAddress: '',
                        defaultEventTimeConsumptionBar: [50, 100],
                        defaultUserExpireDays: 120
                    }
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('Edit system config (mismatch)', async () => {
            const response = await admin.post('/trpc/config.editConfig')
                .send({
                    configType: enumConfigType.STUDYCONFIG,
                    key: null,
                    properties: {
                        id: 'root_system_config_protected',
                        type: enumConfigType.SYSTEMCONFIG,
                        key: null,
                        id: 'root_system_config',
                        life: {
                            createdTime: Date.now(),
                            createdUser: 'SYSTEM',
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {},
                        defaultBackgroundColor: '#FFFFFF',
                        defaultMaximumFileSize: 1 * 1024 * 1024 * 1024, // 1 GB
                        defaultFileBucketId: 'system',
                        defaultProfileBucketId: 'profile',
                        logoLink: null,
                        logoSize: ['24px', '24px'],
                        archiveAddress: '',
                        defaultEventTimeConsumptionBar: [50, 100],
                        defaultUserExpireDays: 120
                    }
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Config type and properties do not match.');
        });
        test('Edit system config (not existing)', async () => {
            const response = await admin.post('/trpc/config.editConfig')
                .send({
                    configType: enumConfigType.STUDYCONFIG,
                    key: 'random',
                    properties: {
                        id: 'root_system_config_protected',
                        type: enumConfigType.STUDYCONFIG,
                        key: 'random',
                        id: 'root_system_config',
                        life: {
                            createdTime: Date.now(),
                            createdUser: 'SYSTEM',
                            deletedTime: null,
                            deletedUser: null
                        },
                        defaultFileBucketId: 'system',
                        metadata: {},
                        defaultStudyProfile: null,
                        defaultMaximumFileSize: 8 * 1024 * 1024 * 1024, // 8 GB,
                        defaultRepresentationForMissingValue: '99999',
                        defaultFileBlocks: [],
                        defaultVersioningKeys: []
                    }
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Config does not exist.');
        });
    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}
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
import { enumUserTypes, enumStudyRoles, enumCoreErrors } from '@itmat-broker/itmat-types';
import { encodeQueryParams } from './helper';

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
    });

    describe('tRPC data APIs', () => {
        test('getUserRoles (admin)', async () => {
            const parameters = { userId: authorisedUserProfile.id };
            const response = await admin.get('/trpc/role.getUserRoles?input=' + encodeQueryParams(parameters));
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(1);
            expect(response.body.result.data[0].id).toBe(fullPermissionRole.id);
        });
        test('getUserRoles (authorised user)', async () => {
            const parameters = { userId: authorisedUserProfile.id };
            const response = await authorisedUser.get('/trpc/role.getUserRoles?input=' + encodeQueryParams(parameters));
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(1);
            expect(response.body.result.data[0].id).toBe(fullPermissionRole.id);
        });
        test('getUserRoles (with studyId)', async () => {
            const parameters = { userId: authorisedUserProfile.id, studyId: study.id };
            const response = await authorisedUser.get('/trpc/role.getUserRoles?input=' + encodeQueryParams(parameters));
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(1);
            expect(response.body.result.data[0].id).toBe(fullPermissionRole.id);
        });
        test('getUserRoles (with incorrect study Id)', async () => {
            const parameters = { userId: authorisedUserProfile.id, studyId: 'incorrect' };
            const response = await authorisedUser.get('/trpc/role.getUserRoles?input=' + encodeQueryParams(parameters));
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(0);
        });
        test('getUserRoles (unauthorised user)', async () => {
            const parameters = { userId: authorisedUserProfile.id };
            const response = await user.get('/trpc/role.getUserRoles?input=' + encodeQueryParams(parameters));
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('getStudyRoles (admin)', async () => {
            const parameters = { studyId: study.id };
            const response = await admin.get('/trpc/role.getStudyRoles?input=' + encodeQueryParams(parameters));
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(1);
            expect(response.body.result.data[0].id).toBe(fullPermissionRole.id);
        });
        test('getStudyRoles (authorised user)', async () => {
            const parameters = { studyId: study.id };
            const response = await authorisedUser.get('/trpc/role.getStudyRoles?input=' + encodeQueryParams(parameters));
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(1);
            expect(response.body.result.data[0].id).toBe(fullPermissionRole.id);
        });
        test('getStudyRoles (unauthorised user)', async () => {
            const parameters = { studyId: study.id };
            const response = await user.get('/trpc/role.getStudyRoles?input=' + encodeQueryParams(parameters));
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('createStudyRole (admin)', async () => {
            const response = await admin.post('/trpc/role.createStudyRole').send({
                studyId: study.id,
                name: 'New Role',
                description: 'New Role Description',
                dataPermissions: [{
                    fields: ['^1.*$'],
                    dataProperties: {},
                    permission: parseInt('111', 2),
                    includeUnVersioned: true
                }],
                studyRole: enumStudyRoles.STUDY_MANAGER,
                users: [authorisedUserProfile.id]
            });
            expect(response.status).toBe(200);
            const roleInDb = await db.collections.roles_collection.findOne({ name: 'New Role' });
            expect(roleInDb?.id).toBe(response.body.result.data.id);
        });
        test('createStudyRole (authorised user)', async () => {
            const response = await authorisedUser.post('/trpc/role.createStudyRole').send({
                studyId: study.id,
                name: 'New Role',
                description: 'New Role Description',
                dataPermissions: [{
                    fields: ['^1.*$'],
                    dataProperties: {},
                    permission: parseInt('111', 2),
                    includeUnVersioned: true
                }],
                studyRole: enumStudyRoles.STUDY_MANAGER,
                users: [authorisedUserProfile.id]
            });
            expect(response.status).toBe(200);
            const roleInDb = await db.collections.roles_collection.findOne({ name: 'New Role' });
            expect(roleInDb?.id).toBe(response.body.result.data.id);
        });
        test('createStudyRole (unauthorised user)', async () => {
            const response = await user.post('/trpc/role.createStudyRole').send({
                studyId: study.id,
                name: 'New Role',
                description: 'New Role Description',
                dataPermissions: [{
                    fields: ['^1.*$'],
                    dataProperties: {},
                    permission: parseInt('111', 2),
                    includeUnVersioned: true
                }],
                studyRole: enumStudyRoles.STUDY_MANAGER,
                users: [authorisedUserProfile.id]
            });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('editStudyRole (admin)', async () => {
            const response = await admin.post('/trpc/role.editStudyRole').send({
                roleId: fullPermissionRole.id,
                name: 'Edited Role Name'
            });
            expect(response.status).toBe(200);
            const roleInDb = await db.collections.roles_collection.findOne({ id: fullPermissionRole.id });
            expect(roleInDb?.name).toBe('Edited Role Name');
        });
        test('editStudyRole (authorised user)', async () => {
            const response = await authorisedUser.post('/trpc/role.editStudyRole').send({
                roleId: fullPermissionRole.id,
                name: 'Edited Role Name'
            });
            expect(response.status).toBe(200);
            const roleInDb = await db.collections.roles_collection.findOne({ id: fullPermissionRole.id });
            expect(roleInDb?.name).toBe('Edited Role Name');
        });
        test('editStudyRole (unauthorised user)', async () => {
            const response = await user.post('/trpc/role.editStudyRole').send({
                roleId: fullPermissionRole.id,
                name: 'Edited Role Name'
            });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('editStudyRole (invalid roleId)', async () => {
            const response = await user.post('/trpc/role.editStudyRole').send({
                roleId: 'random',
                name: 'Edited Role Name'
            });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('deleteStudyRole (admin)', async () => {
            const response = await admin.post('/trpc/role.deleteStudyRole').send({
                roleId: fullPermissionRole.id
            });
            expect(response.status).toBe(200);
            const roleInDb = await db.collections.roles_collection.findOne({ id: fullPermissionRole.id });
            expect(roleInDb?.life.deletedTime).not.toBeNull();
        });
        test('deleteStudyRole (authorised user)', async () => {
            const response = await authorisedUser.post('/trpc/role.deleteStudyRole').send({
                roleId: fullPermissionRole.id
            });
            expect(response.status).toBe(200);
            const roleInDb = await db.collections.roles_collection.findOne({ id: fullPermissionRole.id });
            expect(roleInDb?.life.deletedTime).not.toBeNull();
        });
        test('deleteStudyRole (unauthorised user)', async () => {
            const response = await user.post('/trpc/role.deleteStudyRole').send({
                roleId: fullPermissionRole.id
            });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
        test('deleteStudyRole (invalid roleId)', async () => {
            const response = await user.post('/trpc/role.deleteStudyRole').send({
                roleId: 'random'
            });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(enumCoreErrors.NO_PERMISSION_ERROR);
        });
    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}
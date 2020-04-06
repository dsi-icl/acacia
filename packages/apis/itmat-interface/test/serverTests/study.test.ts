import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { errorCodes } from '../../src/graphql/errors';
import { MongoClient } from 'mongodb';
import { WHO_AM_I, CREATE_PROJECT, CREATE_STUDY, DELETE_STUDY, permissions, userTypes } from '@itmat/commons';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from '../../../../libraries/itmat-utils/src/databaseSetup/collectionsAndIndexes';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';

let app;
let mongodb;
let admin;
let user;
let mongoConnection;
let mongoClient;

afterAll(async () => {
    await db.closeConnection();
    await mongoConnection?.close();
    await mongodb.stop();
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
    await db.connect(config.database);
    const router = new Router();

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
});

describe('STUDY API', () => {
    let adminId;
    let userId;

    beforeAll(async () => {
        /* setup: first retrieve the generated user id */
        const result = await mongoClient.collection(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
        adminId = result.filter(e => e.username === 'admin')[0].id;
        userId = result.filter(e => e.username === 'standardUser')[0].id;
    });

    describe('MANIPULATING STUDIES EXISTENCE', () => {
        test('Create study (admin)', async () => {
            const studyName = uuid();
            const res = await admin.post('/graphql').send({
                query: print(CREATE_STUDY),
                variables: { name: studyName }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();

            const createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: studyName });
            expect(res.body.data.createStudy).toEqual({
                id: createdStudy.id,
                name: studyName
            });

            const resWhoAmI = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
            expect(resWhoAmI.status).toBe(200);
            expect(resWhoAmI.body.data.errors).toBeUndefined();
            expect(resWhoAmI.body.data.whoAmI).toEqual({
                username: 'admin',
                type: userTypes.ADMIN,
                realName: 'admin',
                createdBy: 'chon',
                organisation: 'DSI',
                email: 'admin@user.io',
                description: 'I am an admin user.',
                id: adminId,
                access: {
                    id: `user_access_obj_user_id_${adminId}`,
                    projects: [],
                    studies: [{
                        id: createdStudy.id,
                        name: studyName
                    }]
                }
            });

            /* cleanup: delete study */
            await mongoClient.collection(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        });

        test('Create study that violate unique name constraint (admin)', async () => {
            const studyName = uuid();
            const newStudy = {
                id: `id_${studyName}`,
                name: studyName,
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(newStudy);

            const res = await admin.post('/graphql').send({
                query: print(CREATE_STUDY),
                variables: { name: studyName }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(`Study "${studyName}" already exists (duplicates are case-insensitive).`);
            expect(res.body.data.createStudy).toBe(null);

            /* should be only one study in database */
            const study = await mongoClient.collection(config.database.collections.studies_collection).find({ name: studyName }).toArray();
            expect(study).toEqual([newStudy]);

            /* cleanup: delete study */
            await mongoClient.collection(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        });

        test('Create study that violate unique name constraint (case insensitive) (admin)', async () => {
            const studyName = uuid();
            const newStudy = {
                id: `id_${studyName}`,
                name: studyName,
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(newStudy);

            const res = await admin.post('/graphql').send({
                query: print(CREATE_STUDY),
                variables: { name: studyName.toUpperCase() }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(`Study "${studyName.toUpperCase()}" already exists (duplicates are case-insensitive).`);
            expect(res.body.data.createStudy).toBe(null);

            /* should be only one study in database */
            const study = await mongoClient.collection(config.database.collections.studies_collection).find({ name: { $in: [studyName, studyName.toUpperCase()] } }).toArray();
            expect(study).toEqual([newStudy]);

            /* cleanup: delete study */
            await mongoClient.collection(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        });

        test('Create study (user) (should fail)', async () => {
            const studyName = uuid();
            const res = await user.post('/graphql').send({
                query: print(CREATE_STUDY),
                variables: { name: studyName }
            });
            expect(res.status).toBe(200);
            expect(res.body.data.createStudy).toBe(null);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);

            const createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: studyName });
            expect(createdStudy).toBe(null);
        });

        test('Delete study (no projects) (admin)', async () => {
            /* setup: create a study to be deleted */
            const studyName = uuid();
            const newStudy = {
                id: `id_${studyName}`,
                name: studyName,
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(newStudy);

            const resWhoAmI = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
            expect(resWhoAmI.status).toBe(200);
            expect(resWhoAmI.body.data.errors).toBeUndefined();
            expect(resWhoAmI.body.data.whoAmI).toEqual({
                username: 'admin',
                type: userTypes.ADMIN,
                realName: 'admin',
                createdBy: 'chon',
                organisation: 'DSI',
                email: 'admin@user.io',
                description: 'I am an admin user.',
                id: adminId,
                access: {
                    id: `user_access_obj_user_id_${adminId}`,
                    projects: [],
                    studies: [{
                        id: newStudy.id,
                        name: studyName
                    }]
                }
            });

            /* test */
            const res = await admin.post('/graphql').send({
                query: print(DELETE_STUDY),
                variables: { studyId: newStudy.id }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.deleteStudy).toEqual({
                id: newStudy.id,
                successful: true
            });

            const study = await mongoClient.collection(config.database.collections.studies_collection).findOne({ id: newStudy.id });
            expect(typeof study.deleted).toBe('number');

            const resWhoAmIAfter = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
            expect(resWhoAmIAfter.status).toBe(200);
            expect(resWhoAmIAfter.body.data.errors).toBeUndefined();
            expect(resWhoAmIAfter.body.data.whoAmI).toEqual({
                username: 'admin',
                type: userTypes.ADMIN,
                realName: 'admin',
                createdBy: 'chon',
                organisation: 'DSI',
                email: 'admin@user.io',
                description: 'I am an admin user.',
                id: adminId,
                access: {
                    id: `user_access_obj_user_id_${adminId}`,
                    projects: [],
                    studies: []
                }
            });
        });

        test('Delete study that has been deleted (no projects) (admin)', async () => {
            /* setup: create a study to be deleted */
            const studyName = uuid();
            const newStudy = {
                id: `id_${studyName}`,
                name: studyName,
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: new Date().valueOf(),
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(newStudy);

            /* test */
            const res = await admin.post('/graphql').send({
                query: print(DELETE_STUDY),
                variables: { studyId: newStudy.id }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            expect(res.body.data.deleteStudy).toEqual(null);
        });

        test('Delete study (with attached projects) (admin)', async () => {
            // TODO
        });

        test('Delete study that never existed (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(DELETE_STUDY),
                variables: { studyId: 'I_never_existed' }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            expect(res.body.data.deleteStudy).toEqual(null);
        });

        test('Delete study (user) (should fail)', async () => {
            /* setup: create a study to be deleted */
            const studyName = uuid();
            const newStudy = {
                id: `id_${studyName}`,
                name: studyName,
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(newStudy);

            const res = await user.post('/graphql').send({
                query: print(DELETE_STUDY),
                variables: { studyId: studyName }
            });
            expect(res.status).toBe(200);
            expect(res.body.data.deleteStudy).toBe(null);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);

            /* confirms that the created study is still alive */
            const createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: studyName });
            expect(createdStudy.deleted).toBe(null);

            /* cleanup: delete study */
            await mongoClient.collection(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        });
    });

    describe('MANIPULATING PROJECTS EXISTENCE', () => {
        let setupStudy;
        beforeEach(async () => {
            const studyName = uuid();
            setupStudy = {
                id: `id_${studyName}`,
                name: studyName,
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(setupStudy);
        });

        test('Create project (no existing patients in study) (admin)', async () => {
            const projectName = uuid();
            const res = await admin.post('/graphql').send({
                query: print(CREATE_PROJECT),
                variables: {
                    studyId: setupStudy.id,
                    projectName
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();

            const createdProject = await mongoClient.collection(config.database.collections.projects_collection).findOne({ name: projectName });
            expect(createdProject).toEqual({
                _id: createdProject._id,
                id: createdProject.id,
                studyId: setupStudy.id,
                createdBy: adminId,
                patientMapping: {},
                name: projectName,
                approvedFields: {},
                approvedFiles: [],
                lastModified: createdProject.lastModified,
                deleted: null
            });
            expect(res.body.data.createProject).toEqual({
                id: createdProject.id,
                studyId: setupStudy.id,
                name: projectName,
                approvedFields: {}
            });
        });

        test('Create project (existing patients in study) (admin)', async () => {
            // TODO
        });

        test('Create project (user with no privilege) (should fail)', async () => {
            const res = await user.post('/graphql').send({
                query: print(CREATE_PROJECT),
                variables: {
                    studyId: setupStudy.id,
                    projectName: 'new_project_4'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            expect(res.body.data.createProject).toBe(null);
        });

        test('Create project (user with privilege)', async () => {
            /* setup: creating a privileged user */
            const username = uuid();
            const authorisedUserProfile = {
                username,
                type: 'STANDARD',
                realName: `${username}_realname`,
                password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                createdBy: 'admin',
                email: `${username}@user.io`,
                description: 'I am a new user.',
                emailNotificationsActivated: true,
                organisation: 'DSI',
                deleted: null,
                id: `new_user_id_${username}`
            };
            await mongoClient.collection(config.database.collections.users_collection).insertOne(authorisedUserProfile);

            const roleId = uuid();
            const newRole = {
                id: roleId,
                projectId: null,
                studyId: setupStudy.id,
                name: `${roleId}_rolename`,
                permissions: [
                    permissions.specific_study.specific_study_projects_management
                ],
                users: [authorisedUserProfile.id],
                deleted: null
            };
            await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

            const authorisedUser = request.agent(app);
            await connectAgent(authorisedUser, username, 'admin');

            /* test */
            const projectName = uuid();
            const res = await authorisedUser.post('/graphql').send({
                query: print(CREATE_PROJECT),
                variables: {
                    studyId: setupStudy.id,
                    projectName
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            const createdProject = await mongoClient.collection(config.database.collections.projects_collection).findOne({ name: projectName });
            expect(createdProject).toEqual({
                _id: createdProject._id,
                id: createdProject.id,
                studyId: setupStudy.id,
                createdBy: authorisedUserProfile.id,
                patientMapping: {},
                name: projectName,
                approvedFields: {},
                approvedFiles: [],
                lastModified: createdProject.lastModified,
                deleted: null
            });
            expect(res.body.data.createProject).toEqual({
                id: createdProject.id,
                studyId: setupStudy.id,
                name: projectName,
                approvedFields: {}
            });
        });
    });
});
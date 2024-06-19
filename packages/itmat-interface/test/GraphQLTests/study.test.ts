/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { errorCodes } from '@itmat-broker/itmat-cores';
import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
import {
    GET_STUDY_FIELDS,
    GET_STUDY,
    GET_PROJECT,
    GET_USERS,
    EDIT_ROLE,
    ADD_NEW_ROLE,
    WHO_AM_I,
    CREATE_PROJECT,
    CREATE_STUDY,
    DELETE_STUDY,
    DELETE_PROJECT,
    SET_DATAVERSION_AS_CURRENT,
    EDIT_STUDY,
    UPLOAD_DATA_IN_ARRAY,
    DELETE_DATA_RECORDS,
    GET_DATA_RECORDS,
    CREATE_NEW_DATA_VERSION,
    CREATE_NEW_FIELD,
    DELETE_FIELD,
    CREATE_ONTOLOGY_TREE,
    DELETE_ONTOLOGY_TREE,
    GET_ONTOLOGY_TREE
} from '@itmat-broker/itmat-models';
import {
    enumUserTypes,
    studyType,
    enumDataTypes,
    IDataEntry,
    IUser,
    IFile,
    IField,
    IStudyDataVersion,
    IStudy,
    IProject,
    IRole,
    IPermissionManagementOptions,
    atomicOperation,
    enumReservedUsers,
    IData,
    enumFileTypes,
    enumFileCategories
} from '@itmat-broker/itmat-types';
import { Express } from 'express';
import path from 'path';
import { objStore } from '../../src/objStore/objStore';

if (global.hasMinio) {
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
        config.objectStore.port = global.minioContainerPort;
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

    describe('STUDY API', () => {
        let adminId: any;

        beforeAll(async () => {
            /* setup: first retrieve the generated user id */
            const result = await mongoClient.collection<IUser>(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
            adminId = result.filter((e: { username: string; }) => e.username === 'admin')[0].id;
        });

        describe('MANIPULATING STUDIES EXISTENCE', () => {
            test('Create study (admin)', async () => {
                const studyName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_STUDY),
                    variables: { name: studyName, description: 'test description', type: studyType.SENSOR }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();

                const createdStudy = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOne({ name: studyName });
                expect(res.body.data.createStudy).toEqual({
                    id: createdStudy.id,
                    name: studyName,
                    description: 'test description',
                    type: studyType.SENSOR
                });

                const resWhoAmI = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
                expect(resWhoAmI.status).toBe(200);
                expect(resWhoAmI.body.data.errors).toBeUndefined();
                expect(resWhoAmI.body.data.whoAmI).toEqual({
                    username: 'admin',
                    type: enumUserTypes.ADMIN,
                    firstname: 'Fadmin',
                    lastname: 'Ladmin',
                    organisation: 'organisation_system',
                    email: 'admin@example.com',
                    description: 'I am an admin user.',
                    id: adminId,
                    access: {
                        id: `user_access_obj_user_id_${adminId}`,
                        projects: [],
                        studies: [{
                            id: createdStudy.id,
                            name: studyName
                        }]
                    },
                    emailNotificationsActivated: true,
                    emailNotificationsStatus: { expiringNotification: false },
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000,
                    metadata: {}
                });

                /* cleanup: delete study */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ 'name': studyName, 'life.deletedTime': null }, { $set: { 'life.deletedUser': 'admin', 'life.deletedTime': new Date().valueOf() } });
            });

            test('Edit study (admin)', async () => {
                const studyName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_STUDY),
                    variables: { name: studyName, description: 'test description', type: studyType.SENSOR }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();

                const createdStudy = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOne({ name: studyName });
                expect(res.body.data.createStudy).toEqual({
                    id: createdStudy.id,
                    name: studyName,
                    description: 'test description',
                    type: studyType.SENSOR
                });

                const editStudy = await admin.post('/graphql').send({
                    query: print(EDIT_STUDY),
                    variables: { studyId: createdStudy.id, description: 'edited description' }
                });
                expect(editStudy.body.data.editStudy).toEqual({
                    id: createdStudy.id,
                    name: studyName,
                    description: 'edited description'
                });

                /* cleanup: delete study */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ 'name': studyName, 'life.deletedTime': null }, { $set: { 'life.deletedUser': 'admin', 'life.deletedTime': new Date().valueOf() } });
            });

            test('Create study that violate unique name constraint (admin)', async () => {
                const studyName = uuid();
                const newStudy: IStudy = {
                    id: `id_${studyName}`,
                    name: studyName,
                    currentDataVersion: -1,
                    dataVersions: [],
                    life: {
                        createdTime: 200000002,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(newStudy);

                const res = await admin.post('/graphql').send({
                    query: print(CREATE_STUDY),
                    variables: { name: studyName, description: 'test description', type: studyType.SENSOR }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(`Study "${studyName}" already exists (duplicates are case-insensitive).`);
                expect(res.body.data.createStudy).toBe(null);

                /* should be only one study in database */
                const study = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).find({ name: studyName }).toArray();
                expect(study).toEqual([newStudy]);

                /* cleanup: delete study */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ 'name': studyName, 'life.deletedTime': null }, { $set: { 'life.deletedUser': 'admin', 'life.deletedTime': new Date().valueOf() } });
            });

            test('Create study that violate unique name constraint (case insensitive) (admin)', async () => {
                const studyName = uuid();
                const newStudy: IStudy = {
                    id: `id_${studyName}`,
                    name: studyName,
                    currentDataVersion: -1,
                    dataVersions: [],
                    life: {
                        createdTime: 200000002,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(newStudy);

                const res = await admin.post('/graphql').send({
                    query: print(CREATE_STUDY),
                    variables: { name: studyName.toUpperCase(), description: 'test description', type: studyType.SENSOR }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(`Study "${studyName.toUpperCase()}" already exists (duplicates are case-insensitive).`);
                expect(res.body.data.createStudy).toBe(null);

                /* should be only one study in database */
                const study = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).find({ name: { $in: [studyName, studyName.toUpperCase()] } }).toArray();
                expect(study).toEqual([newStudy]);

                /* cleanup: delete study */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ 'name': studyName, 'life.deletedTime': null }, { $set: { 'life.deletedUser': 'admin', 'life.deletedTime': new Date().valueOf() } });
            });

            test('Create study (user) (should fail)', async () => {
                const studyName = uuid();
                const res = await user.post('/graphql').send({
                    query: print(CREATE_STUDY),
                    variables: { name: studyName, description: 'test description', type: studyType.SENSOR }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.createStudy).toBe(null);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);

                const createdStudy = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOne({ name: studyName });
                expect(createdStudy).toBe(null);
            });

            test('Edit study (user) (should fail)', async () => {
                const studyName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_STUDY),
                    variables: { name: studyName, description: 'test description', type: studyType.SENSOR }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();

                const createdStudy = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOne({ name: studyName });
                expect(res.body.data.createStudy).toEqual({
                    id: createdStudy.id,
                    name: studyName,
                    description: 'test description',
                    type: studyType.SENSOR
                });

                const editStudy = await user.post('/graphql').send({
                    query: print(EDIT_STUDY),
                    variables: { studyId: createdStudy.id, description: 'edited description' }
                });
                expect(editStudy.status).toBe(200);
                expect(editStudy.body.data.editStudy).toBe(null);
                expect(editStudy.body.errors).toHaveLength(1);
                expect(editStudy.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);

                /* cleanup: delete study */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ 'name': studyName, 'life.deletedTime': null }, { $set: { 'life.deletedUser': 'admin', 'life.deletedTime': new Date().valueOf() } });
            });

            test('Delete study (no projects) (admin)', async () => {
                /* setup: create a study to be deleted */
                const studyName = uuid();
                const newStudy: IStudy = {
                    id: `id_${studyName}`,
                    name: studyName,
                    currentDataVersion: -1,
                    dataVersions: [],
                    life: {
                        createdTime: 200000002,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(newStudy);

                const resWhoAmI = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
                expect(resWhoAmI.status).toBe(200);
                expect(resWhoAmI.body.data.errors).toBeUndefined();
                expect(resWhoAmI.body.data.whoAmI).toEqual({
                    username: 'admin',
                    type: enumUserTypes.ADMIN,
                    firstname: 'Fadmin',
                    lastname: 'Ladmin',
                    organisation: 'organisation_system',
                    email: 'admin@example.com',
                    description: 'I am an admin user.',
                    id: adminId,
                    access: {
                        id: `user_access_obj_user_id_${adminId}`,
                        projects: [],
                        studies: [{
                            id: newStudy.id,
                            name: studyName
                        }]
                    },
                    emailNotificationsActivated: true,
                    emailNotificationsStatus: { expiringNotification: false },
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000,
                    metadata: {}
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

                const study = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOne({ id: newStudy.id });
                expect(typeof study?.life.deletedTime).toBe('number');

                const resWhoAmIAfter = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
                expect(resWhoAmIAfter.status).toBe(200);
                expect(resWhoAmIAfter.body.data.errors).toBeUndefined();
                expect(resWhoAmIAfter.body.data.whoAmI).toEqual({
                    username: 'admin',
                    type: enumUserTypes.ADMIN,
                    firstname: 'Fadmin',
                    lastname: 'Ladmin',
                    organisation: 'organisation_system',
                    email: 'admin@example.com',
                    description: 'I am an admin user.',
                    id: adminId,
                    access: {
                        id: `user_access_obj_user_id_${adminId}`,
                        projects: [],
                        studies: []
                    },
                    emailNotificationsActivated: true,
                    emailNotificationsStatus: { expiringNotification: false },
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000,
                    metadata: {}
                });
            });

            test('Delete study that has been deleted (no projects) (admin)', async () => {
                /* setup: create a study to be deleted */
                const studyName = uuid();
                const newStudy: IStudy = {
                    id: `id_${studyName}`,
                    name: studyName,
                    currentDataVersion: -1,
                    dataVersions: [],
                    life: {
                        createdTime: 200000002,
                        createdUserId: 'admin',
                        deletedTime: 10000,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(newStudy);

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(DELETE_STUDY),
                    variables: { studyId: newStudy.id }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe('Study does not exist.');
                expect(res.body.data.deleteStudy).toEqual(null);
            });

            test('Delete study that never existed (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(DELETE_STUDY),
                    variables: { studyId: 'I_never_existed' }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe('Study does not exist.');
                expect(res.body.data.deleteStudy).toEqual(null);
            });

            test('Delete study (user) (should fail)', async () => {
                /* setup: create a study to be deleted */
                const studyName = uuid();
                const newStudy: IStudy = {
                    id: `id_${studyName}`,
                    name: studyName,
                    currentDataVersion: -1,
                    dataVersions: [],
                    life: {
                        createdTime: 200000002,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(newStudy);

                const res = await user.post('/graphql').send({
                    query: print(DELETE_STUDY),
                    variables: { studyId: studyName }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.deleteStudy).toBe(null);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);

                /* confirms that the created study is still alive */
                const createdStudy = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOne({ name: studyName });
                expect(createdStudy?.life.deletedTime).toBe(null);

                /* cleanup: delete study */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ 'name': studyName, 'life.deletedTime': null }, { $set: { 'life.deletedUser': 'admin', 'life.deletedTime': new Date().valueOf() } });
            });
        });

        describe('MANIPULATING PROJECTS EXISTENCE', () => {
            let testCounter = 0;
            let setupStudy: IStudy;
            let setupProject: { id: any; studyId?: string; createdBy?: string; name?: string; patientMapping?: { patient001: string; }; lastModified?: number; deleted?: null; };
            beforeEach(async () => {
                testCounter++;
                /* setup: creating a study */
                const studyName = uuid() + 'STUDYNAME_manipulating_project_existentce_' + testCounter;
                setupStudy = {
                    id: `id_${studyName}`,
                    name: studyName,
                    currentDataVersion: 0,
                    dataVersions: [
                        {
                            id: 'dataVersionId',
                            contentId: 'dataVersionContentId',
                            version: '1',
                            tag: '1',
                            updateDate: '1628049066475'
                        }
                    ],
                    life: {
                        createdTime: 20000001,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(setupStudy);

                /* setup: creating a project */
                const projectName = uuid() + 'PROJECTNAME_manipulating_project_existentce_' + testCounter;
                setupProject = {
                    id: `id_${projectName}`,
                    studyId: setupStudy.id,
                    createdBy: 'admin',
                    name: projectName,
                    patientMapping: { patient001: 'patientA' },
                    lastModified: 20000002,
                    deleted: null
                };
                await mongoClient.collection<IProject>(config.database.collections.projects_collection).insertOne(setupProject);
            });

            afterEach(async () => {
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).updateOne({ id: setupStudy.id }, { $set: { 'life.deletedTime': 10000 } });
                await mongoClient.collection<IProject>(config.database.collections.projects_collection).updateOne({ id: setupProject.id }, { $set: { deleted: 10000 } });
            });

            test('Create project (no existing patients in study) (admin)', async () => {
                const projectName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_PROJECT),
                    variables: {
                        studyId: setupStudy.id,
                        projectName: projectName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();

                const createdProject = await mongoClient.collection<IProject>(config.database.collections.projects_collection).findOne({ name: projectName });
                expect(createdProject).toEqual({
                    _id: createdProject._id,
                    id: createdProject.id,
                    studyId: setupStudy.id,
                    createdBy: adminId,
                    name: projectName,
                    patientMapping: {},
                    lastModified: createdProject.lastModified,
                    deleted: null,
                    metadata: {}
                });
                expect(res.body.data.createProject).toEqual({
                    id: createdProject.id,
                    studyId: setupStudy.id,
                    name: projectName
                });

                /* cleanup: delete project */
                await mongoClient.collection<IProject>(config.database.collections.projects_collection).updateOne({ id: createdProject.id }, { $set: { deleted: 10000 } });
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
                const authorisedUserProfile: IUser = {
                    username,
                    type: enumUserTypes.STANDARD,
                    firstname: `${username}_firstname`,
                    lastname: `${username}_lastname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@example.com`,
                    resetPasswordRequests: [],
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    emailNotificationsStatus: { expiringNotification: false },
                    organisation: 'organisation_system',
                    id: `new_user_id_${username}`,
                    expiredAt: 1991134065000,
                    life: {
                        createdTime: 1591134065000,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(authorisedUserProfile);

                const roleId = uuid();
                const newRole = {
                    id: roleId,
                    studyId: setupStudy.id,
                    name: `${roleId}_rolename`,
                    permissions: {
                        data: {
                            fieldIds: ['^.*$'],
                            hasVersioned: false,
                            uploaders: ['^.*$'],
                            operations: ['^.*$'],
                            subjectIds: ['^.*$'],
                            visitIds: ['^.*$']
                        },
                        manage: {
                            [IPermissionManagementOptions.own]: [atomicOperation.READ, atomicOperation.WRITE],
                            [IPermissionManagementOptions.role]: [],
                            [IPermissionManagementOptions.job]: [],
                            [IPermissionManagementOptions.query]: [],
                            [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                        }
                    },
                    users: [authorisedUserProfile.id],
                    deleted: null
                };
                await mongoClient.collection<IRole>(config.database.collections.roles_collection).insertOne(newRole);

                const authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

                /* test */
                const projectName = uuid();
                const res = await authorisedUser.post('/graphql').send({
                    query: print(CREATE_PROJECT),
                    variables: {
                        studyId: setupStudy.id,
                        projectName: projectName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                const createdProject = await mongoClient.collection<IProject>(config.database.collections.projects_collection).findOne({ name: projectName });
                expect(createdProject).toEqual({
                    _id: createdProject._id,
                    id: createdProject.id,
                    studyId: setupStudy.id,
                    createdBy: authorisedUserProfile.id,
                    patientMapping: {},
                    name: projectName,
                    lastModified: createdProject.lastModified,
                    deleted: null,
                    metadata: {}
                });
                expect(res.body.data.createProject).toEqual({
                    id: createdProject.id,
                    studyId: setupStudy.id,
                    name: projectName
                });

                /* cleanup: delete project */
                await mongoClient.collection<IProject>(config.database.collections.projects_collection).updateOne({ id: createdProject.id }, { $set: { deleted: 10000 } });
            });

            test('Delete project (user without privilege) (should fail)', async () => {
                const res = await user.post('/graphql').send({
                    query: print(DELETE_PROJECT),
                    variables: {
                        projectId: setupProject.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.deleteProject).toEqual(null);
                /* TO_DO make sure api project is not gone */
            });

            test('Delete project (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(DELETE_PROJECT),
                    variables: {
                        projectId: setupProject.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.deleteProject).toEqual({
                    id: setupProject.id,
                    successful: true
                });
                /* TO_DO make sure api project is gone */
            });

            test('Delete project (user with privilege)', async () => {
                /* setup: creating a privileged user */
                const username = uuid();
                const authorisedUserProfile: IUser = {
                    username,
                    type: enumUserTypes.STANDARD,
                    firstname: `${username}_firstname`,
                    lastname: `${username}_lastname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@example.com`,
                    resetPasswordRequests: [],
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    emailNotificationsStatus: { expiringNotification: false },
                    organisation: 'organisation_system',
                    id: `new_user_id_${username}`,
                    expiredAt: 1991134065000,
                    life: {
                        createdTime: 1591134065000,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(authorisedUserProfile);

                const roleId = uuid();
                const newRole = {
                    id: roleId,
                    studyId: setupStudy.id,
                    name: `${roleId}_rolename`,
                    permissions: {
                        data: {
                            fieldIds: [],
                            hasVersioned: false,
                            uploaders: ['^.*$'],
                            operations: [],
                            subjectIds: [],
                            visitIds: []
                        },
                        manage: {
                            [IPermissionManagementOptions.own]: [atomicOperation.READ, atomicOperation.WRITE],
                            [IPermissionManagementOptions.role]: [],
                            [IPermissionManagementOptions.job]: [],
                            [IPermissionManagementOptions.query]: [],
                            [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                        }
                    },
                    users: [authorisedUserProfile.id],
                    deleted: null
                };
                await mongoClient.collection<IRole>(config.database.collections.roles_collection).insertOne(newRole);

                const authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

                /* test */
                const res = await authorisedUser.post('/graphql').send({
                    query: print(DELETE_PROJECT),
                    variables: {
                        projectId: setupProject.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.deleteProject).toEqual({
                    id: setupProject.id,
                    successful: true
                });
                /* TO_DO make sure api project is gone */
            });

            test('Delete a non-existent project (admin) (should fail)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(DELETE_PROJECT),
                    variables: {
                        projectId: 'I dont exist'
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe('Project does not exist.');
                expect(res.body.data.deleteProject).toEqual(null);
            });
        });

        describe('MINI END-TO-END API TEST, NO UI, NO DATA', () => {
            let createdProject: { id: any; name: any; patientMapping: { mock_patient1: any; mock_patient2: any; }; };
            let createdStudy: { id: any; name: any; };
            let createdRole_study: { _id: any; id: any; name: any; };
            let createdRole_study_manageProject: { _id: any; id: any; name: any; };
            let createdRole_project: { _id: any; id: any; name: any; };
            let createdUserAuthorised: { id: any; firstname: any; lastname: any; username: string; otpSecret: string; };  // profile
            let createdUserAuthorisedStudy: { id: any; firstname: any; lastname: any; username: string; otpSecret: string; };  // profile
            let createdUserAuthorisedStudyManageProjects: { id: any; firstname: any; lastname: any; username: string; otpSecret: string; };  // profile
            let authorisedUser: request.SuperTest<request.Test>; // client
            let authorisedUserStudy: request.SuperTest<request.Test>; // client
            let authorisedUserStudyManageProject: request.SuperTest<request.Test>; // client
            let mockFields: IField[];
            let mockFiles: IFile[];
            let mockDataVersion: IStudyDataVersion;
            const newMockDataVersion: IStudyDataVersion = { // this is not added right away; but multiple tests uses this
                id: 'mockDataVersionId2',
                contentId: 'mockContentId2',
                version: '0.0.2',
                updateDate: '5000000',
                tag: 'hey'
            };

            beforeAll(async () => {
                /*** setup: create a setup study ***/
                /* 1. create study */
                {
                    const studyName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(CREATE_STUDY),
                        variables: { name: studyName, description: 'test description', type: studyType.SENSOR }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    createdStudy = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOne({ name: studyName });
                    expect(res.body.data.createStudy).toEqual({
                        id: createdStudy.id,
                        name: studyName,
                        description: 'test description',
                        type: studyType.SENSOR
                    });
                }

                /* x. mock - add data to the study */
                {
                    mockDataVersion = {
                        id: 'mockDataVersionId',
                        contentId: 'mockContentId',
                        version: '0.0.1',
                        updateDate: '5000000'
                    };
                    const mockData: IData[] = [
                        {
                            id: 'mockData1_1',
                            studyId: createdStudy.id,
                            fieldId: '31',
                            dataVersion: mockDataVersion.id,
                            value: 'male',
                            properties: {
                                m_subjectId: 'mock_patient1',
                                m_visitId: 'mockvisitId'

                            },
                            life: {
                                createdTime: 10000,
                                createdUser: 'admin',
                                deletedTime: null,
                                deletedUser: null
                            },
                            metadata: {}
                        },
                        {
                            id: 'mockData1_2',
                            studyId: createdStudy.id,
                            fieldId: '49',
                            dataVersion: mockDataVersion.id,
                            value: 'England',
                            properties: {
                                m_subjectId: 'mock_patient1',
                                m_visitId: 'mockvisitId'

                            },
                            life: {
                                createdTime: 10001,
                                createdUser: 'admin',
                                deletedTime: null,
                                deletedUser: null
                            },
                            metadata: {}
                        },
                        {
                            id: 'mockData2_1',
                            studyId: createdStudy.id,
                            fieldId: '31',
                            dataVersion: mockDataVersion.id,
                            value: 'female',
                            properties: {
                                m_subjectId: 'mock_patient2',
                                m_visitId: 'mockvisitId'

                            },
                            life: {
                                createdTime: 10002,
                                createdUser: 'admin',
                                deletedTime: null,
                                deletedUser: null
                            },
                            metadata: {}
                        },
                        {
                            id: 'mockData2_2',
                            studyId: createdStudy.id,
                            fieldId: '49',
                            dataVersion: mockDataVersion.id,
                            value: 'France',
                            properties: {
                                m_subjectId: 'mock_patient2',
                                m_visitId: 'mockvisitId'

                            },
                            life: {
                                createdTime: 10003,
                                createdUser: 'admin',
                                deletedTime: null,
                                deletedUser: null
                            },
                            metadata: {}
                        }
                    ];
                    mockFields = [
                        {
                            id: 'mockfield1',
                            studyId: createdStudy.id,
                            fieldId: '31',
                            fieldName: 'Sex',
                            dataType: enumDataTypes.STRING,
                            categoricalOptions: [],
                            unit: 'person',
                            comments: 'mockComments1',
                            dataVersion: 'mockDataVersionId',
                            life: {
                                createdTime: 10000,
                                createdUser: 'admin',
                                deletedTime: null,
                                deletedUser: null
                            },
                            metadata: {}
                        },
                        {
                            id: 'mockfield2',
                            studyId: createdStudy.id,
                            fieldId: '32',
                            fieldName: 'Race',
                            dataType: enumDataTypes.STRING,
                            categoricalOptions: [],
                            unit: 'person',
                            comments: 'mockComments2',
                            dataVersion: 'mockDataVersionId',
                            life: {
                                createdTime: 20000,
                                createdUser: 'admin',
                                deletedTime: null,
                                deletedUser: null
                            },
                            metadata: {}
                        }
                    ];

                    mockFiles = [
                        {
                            id: 'mockfile1_id',
                            studyId: createdStudy.id,
                            userId: null,
                            fileName: 'I7N3G6G-MMM7N3G6G-20200704-20210429.txt',
                            fileSize: '1000',
                            description: 'Just a test file1',
                            properties: {},
                            uri: 'fakeuri',
                            hash: 'b0dc2ae76cdea04dcf4be7fcfbe36e2ce8d864fe70a1895c993ce695274ba7a0',
                            fileType: enumFileTypes.TXT,
                            fileCategory: enumFileCategories.STUDY_DATA_FILE,
                            life: {
                                createdTime: 1599345644000,
                                createdUser: adminId,
                                deletedTime: null,
                                deletedUser: null
                            },
                            metadata: {}
                        },
                        {
                            id: 'mockfile2_id',
                            studyId: createdStudy.id,
                            userId: null,
                            fileName: 'GR6R4AR-MMMS3JSPP-20200601-20200703.json',
                            fileSize: '1000',
                            description: 'Just a test file2',
                            properties: {},
                            uri: 'fakeuri2',
                            hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a3',
                            fileType: enumFileTypes.JSON,
                            fileCategory: enumFileCategories.STUDY_DATA_FILE,
                            life: {
                                createdTime: 1599345644000,
                                createdUser: adminId,
                                deletedTime: null,
                                deletedUser: null
                            },
                            metadata: {}
                        }
                    ];
                    await db.collections.studies_collection.updateOne({ id: createdStudy.id }, {
                        $push: { dataVersions: mockDataVersion },
                        $inc: { currentDataVersion: 1 },
                        $set: {
                            ontologyTrees: [{
                                id: 'testOntology_id',
                                name: 'testOntology',
                                routes: [
                                    {
                                        path: [
                                            'MO',
                                            'MOCK'
                                        ],
                                        name: 'mockfield1',
                                        field: [
                                            '$31'
                                        ],
                                        visitRange: [],
                                        id: '036b7772-f239-4fef-b7f8-c3db883f51e3'
                                    },
                                    {
                                        path: [
                                            'MO',
                                            'MOCK'
                                        ],
                                        name: 'mockfield2',
                                        field: [
                                            '$32'
                                        ],
                                        visitRange: [],
                                        id: 'f577023f-de54-446a-9bbe-1c346823e6bf'
                                    }
                                ]
                            }]
                        }
                    });
                    await db.collections.data_collection.insertMany(mockData);
                    await db.collections.field_dictionary_collection.insertMany(mockFields);
                    await db.collections.files_collection.insertMany(mockFiles);
                }
                /* 2. create projects for the study */
                {
                    const projectName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(CREATE_PROJECT),
                        variables: {
                            studyId: createdStudy.id,
                            projectName: projectName,
                            dataVersion: mockDataVersion.id
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    createdProject = await mongoClient.collection<IProject>(config.database.collections.projects_collection).findOne({ name: projectName });
                    expect(res.body.data.createProject).toEqual({
                        id: createdProject.id,
                        studyId: createdStudy.id,
                        name: projectName
                    });
                }

                /* 3. create roles for study */
                {
                    const roleName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(ADD_NEW_ROLE),
                        variables: {
                            roleName,
                            studyId: createdStudy.id
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();

                    createdRole_study = await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ name: roleName });
                    expect(createdRole_study).toEqual({
                        _id: createdRole_study._id,
                        id: createdRole_study.id,
                        studyId: createdStudy.id,
                        projectId: null,
                        name: roleName,
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        description: '',
                        createdBy: adminId,
                        users: [],
                        deleted: null,
                        metadata: {}
                    });
                    expect(res.body.data.addRole).toEqual({
                        id: createdRole_study.id,
                        name: roleName,
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        studyId: createdStudy.id,
                        projectId: null,
                        users: []
                    });
                }
                /* create another role for study (this time it will have "manage project" privilege - equivalent to PI */
                {
                    const roleName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(ADD_NEW_ROLE),
                        variables: {
                            roleName,
                            studyId: createdStudy.id
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();

                    createdRole_study_manageProject = await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ name: roleName });
                    expect(createdRole_study_manageProject).toEqual({
                        _id: createdRole_study_manageProject._id,
                        id: createdRole_study_manageProject.id,
                        studyId: createdStudy.id,
                        projectId: null,
                        name: roleName,
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        description: '',
                        createdBy: adminId,
                        users: [],
                        deleted: null,
                        metadata: {}
                    });
                    expect(res.body.data.addRole).toEqual({
                        id: createdRole_study_manageProject.id,
                        name: roleName,
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        studyId: createdStudy.id,
                        projectId: null,
                        users: []
                    });
                }

                /* 4. create roles for project */
                {
                    const roleName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(ADD_NEW_ROLE),
                        variables: {
                            roleName,
                            studyId: createdStudy.id,
                            projectId: createdProject.id
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    createdRole_project = await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ name: roleName });
                    expect(createdRole_project).toEqual({
                        _id: createdRole_project._id,
                        id: createdRole_project.id,
                        projectId: createdProject.id,
                        studyId: createdStudy.id,
                        name: roleName,
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        description: '',
                        createdBy: adminId,
                        users: [],
                        deleted: null,
                        metadata: {}
                    });
                    expect(res.body.data.addRole).toEqual({
                        id: createdRole_project.id,
                        name: roleName,
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        studyId: createdStudy.id,
                        projectId: createdProject.id,
                        users: []
                    });
                }

                /* 5. create an authorised project user (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: enumUserTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}@user.io`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised project user.',
                        emailNotificationsActivated: true,
                        emailNotificationsStatus: { expiringNotification: false },
                        organisation: 'organisation_system',
                        id: `AuthorisedProjectUser_${username}`,
                        expiredAt: 1991134065000,
                        life: {
                            createdTime: 1591134065000,
                            createdUserId: 'admin',
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {}
                    };
                    await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
                    createdUserAuthorised = await mongoClient.collection<IUser>(config.database.collections.users_collection).findOne({ username });
                }

                /* 6. add authorised user to role */
                {
                    const res = await admin.post('/graphql').send({
                        query: print(EDIT_ROLE),
                        variables: {
                            roleId: createdRole_project.id,
                            userChanges: {
                                add: [createdUserAuthorised.id],
                                remove: []
                            },
                            permissionChanges: {
                                data: {
                                    fieldIds: ['^.*$'],
                                    hasVersioned: false,
                                    uploaders: ['^.*$'],
                                    operations: [atomicOperation.READ],
                                    subjectIds: ['^.*$'],
                                    visitIds: ['^.*$']
                                },
                                manage: {
                                    [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                    [IPermissionManagementOptions.role]: [],
                                    [IPermissionManagementOptions.job]: [],
                                    [IPermissionManagementOptions.query]: [],
                                    [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                                }
                            }
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.editRole).toEqual({
                        id: createdRole_project.id,
                        name: createdRole_project.name,
                        studyId: createdStudy.id,
                        projectId: createdProject.id,
                        description: '',
                        permissions: {
                            data: {
                                fieldIds: ['^.*$'],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [atomicOperation.READ],
                                subjectIds: ['^.*$'],
                                visitIds: ['^.*$']
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        users: [{
                            id: createdUserAuthorised.id,
                            organisation: 'organisation_system',
                            firstname: createdUserAuthorised.firstname,
                            lastname: createdUserAuthorised.lastname
                        }]
                    });
                    const resUser = await admin.post('/graphql').send({
                        query: print(GET_USERS),
                        variables: {
                            fetchDetailsAdminOnly: false,
                            userId: createdUserAuthorised.id,
                            fetchAccessPrivileges: true
                        }
                    });
                    expect(resUser.status).toBe(200);
                    expect(resUser.body.errors).toBeUndefined();
                    expect(resUser.body.data.getUsers).toHaveLength(1);
                    expect(resUser.body.data.getUsers[0]).toEqual({
                        id: createdUserAuthorised.id,
                        type: enumUserTypes.STANDARD,
                        firstname: `${createdUserAuthorised.username}_firstname`,
                        lastname: `${createdUserAuthorised.username}_lastname`,
                        organisation: 'organisation_system',
                        access: {
                            id: `user_access_obj_user_id_${createdUserAuthorised.id}`,
                            projects: [{
                                id: createdProject.id,
                                name: createdProject.name,
                                studyId: createdStudy.id
                            }],
                            studies: []
                        }
                    });
                    const tag = `metadata.${'role:'.concat(createdRole_project.id)}`;
                    await db.collections.field_dictionary_collection.updateMany({}, {
                        $set: {
                            [tag]: true
                        }
                    });
                    await db.collections.data_collection.updateMany({}, {
                        $set: {
                            [tag]: true
                        }
                    });
                }

                /* 5. create an authorised study user (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: enumUserTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}@user.io`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised study user.',
                        emailNotificationsActivated: true,
                        emailNotificationsStatus: { expiringNotification: false },
                        organisation: 'organisation_system',
                        id: `AuthorisedStudyUser_${username}`,
                        expiredAt: 1991134065000,
                        life: {
                            createdTime: 1591134065000,
                            createdUserId: 'admin',
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {}
                    };
                    await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
                    createdUserAuthorisedStudy = await mongoClient.collection<IUser>(config.database.collections.users_collection).findOne({ username });
                }
                /* 6. add authorised user to role */
                {
                    const res = await admin.post('/graphql').send({
                        query: print(EDIT_ROLE),
                        variables: {
                            roleId: createdRole_study.id,
                            userChanges: {
                                add: [createdUserAuthorisedStudy.id],
                                remove: []
                            },
                            permissionChanges: {
                                data: {
                                    fieldIds: ['^.*$'],
                                    hasVersioned: true,
                                    uploaders: ['^.*$'],
                                    operations: [atomicOperation.READ],
                                    subjectIds: ['^.*$'],
                                    visitIds: ['^.*$']
                                },
                                manage: {
                                    [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                    [IPermissionManagementOptions.role]: [],
                                    [IPermissionManagementOptions.job]: [],
                                    [IPermissionManagementOptions.query]: [],
                                    [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                                }
                            }
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.editRole).toEqual({
                        id: createdRole_study.id,
                        name: createdRole_study.name,
                        studyId: createdStudy.id,
                        projectId: null,
                        description: '',
                        permissions: {
                            data: {
                                fieldIds: ['^.*$'],
                                hasVersioned: true,
                                uploaders: ['^.*$'],
                                operations: [atomicOperation.READ],
                                subjectIds: ['^.*$'],
                                visitIds: ['^.*$']
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        users: [{
                            id: createdUserAuthorisedStudy.id,
                            organisation: 'organisation_system',
                            firstname: createdUserAuthorisedStudy.firstname,
                            lastname: createdUserAuthorisedStudy.lastname
                        }]
                    });
                    const resUser = await admin.post('/graphql').send({
                        query: print(GET_USERS),
                        variables: {
                            fetchDetailsAdminOnly: false,
                            userId: createdUserAuthorisedStudy.id,
                            fetchAccessPrivileges: true
                        }
                    });
                    expect(resUser.status).toBe(200);
                    expect(resUser.body.errors).toBeUndefined();
                    expect(resUser.body.data.getUsers).toHaveLength(1);
                    expect(resUser.body.data.getUsers[0]).toEqual({
                        id: createdUserAuthorisedStudy.id,
                        type: enumUserTypes.STANDARD,
                        firstname: `${createdUserAuthorisedStudy.username}_firstname`,
                        lastname: `${createdUserAuthorisedStudy.username}_lastname`,
                        organisation: 'organisation_system',
                        access: {
                            id: `user_access_obj_user_id_${createdUserAuthorisedStudy.id}`,
                            projects: [{
                                id: createdProject.id,
                                name: createdProject.name,
                                studyId: createdStudy.id
                            }],
                            studies: [{
                                id: createdStudy.id,
                                name: createdStudy.name
                            }]
                        }
                    });
                    const tag = `metadata.${'role:'.concat(createdRole_study.id)}`;
                    await db.collections.field_dictionary_collection.updateMany({}, {
                        $set: {
                            [tag]: true
                        }
                    });
                    await db.collections.data_collection.updateMany({}, {
                        $set: {
                            [tag]: true
                        }
                    });
                }
                /* 5. create an authorised study user that can manage projects (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: enumUserTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}'@user.io'`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised study user managing project.',
                        emailNotificationsActivated: true,
                        emailNotificationsStatus: { expiringNotification: false },
                        organisation: 'organisation_system',
                        id: `AuthorisedStudyUserManageProject_${username}`,
                        expiredAt: 1991134065000,
                        life: {
                            createdTime: 1591134065000,
                            createdUserId: 'admin',
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {}
                    };

                    await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
                    createdUserAuthorisedStudyManageProjects = await mongoClient.collection<IUser>(config.database.collections.users_collection).findOne({ username });
                }

                /* 6. add authorised user to role */
                {
                    const res = await admin.post('/graphql').send({
                        query: print(EDIT_ROLE),
                        variables: {
                            roleId: createdRole_study_manageProject.id,
                            userChanges: {
                                add: [createdUserAuthorisedStudyManageProjects.id],
                                remove: []
                            },
                            permissionChanges: {
                                data: {
                                    fieldIds: [],
                                    hasVersioned: false,
                                    uploaders: ['^.*$'],
                                    operations: [],
                                    subjectIds: [],
                                    visitIds: []
                                },
                                manage: {
                                    [IPermissionManagementOptions.own]: [atomicOperation.READ, atomicOperation.WRITE],
                                    [IPermissionManagementOptions.role]: [],
                                    [IPermissionManagementOptions.job]: [],
                                    [IPermissionManagementOptions.query]: [],
                                    [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                                }
                            }
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.editRole).toEqual({
                        id: createdRole_study_manageProject.id,
                        name: createdRole_study_manageProject.name,
                        studyId: createdStudy.id,
                        projectId: null,
                        description: '',
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ, atomicOperation.WRITE],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        users: [{
                            id: createdUserAuthorisedStudyManageProjects.id,
                            organisation: 'organisation_system',
                            firstname: createdUserAuthorisedStudyManageProjects.firstname,
                            lastname: createdUserAuthorisedStudyManageProjects.lastname
                        }]
                    });
                    const resUser = await admin.post('/graphql').send({
                        query: print(GET_USERS),
                        variables: {
                            fetchDetailsAdminOnly: false,
                            userId: createdUserAuthorisedStudyManageProjects.id,
                            fetchAccessPrivileges: true
                        }
                    });
                    expect(resUser.status).toBe(200);
                    expect(resUser.body.errors).toBeUndefined();
                    expect(resUser.body.data.getUsers).toHaveLength(1);
                    expect(resUser.body.data.getUsers[0]).toEqual({
                        id: createdUserAuthorisedStudyManageProjects.id,
                        type: enumUserTypes.STANDARD,
                        firstname: `${createdUserAuthorisedStudyManageProjects.username}_firstname`,
                        lastname: `${createdUserAuthorisedStudyManageProjects.username}_lastname`,
                        organisation: 'organisation_system',
                        access: {
                            id: `user_access_obj_user_id_${createdUserAuthorisedStudyManageProjects.id}`,
                            projects: [{
                                id: createdProject.id,
                                name: createdProject.name,
                                studyId: createdStudy.id
                            }],
                            studies: [{
                                id: createdStudy.id,
                                name: createdStudy.name
                            }]
                        }
                    });
                }
                /* fsdafs: admin who am i */
                {
                    const res = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
                    expect(res.body.data.whoAmI).toStrictEqual({
                        username: 'admin',
                        type: enumUserTypes.ADMIN,
                        firstname: 'Fadmin',
                        lastname: 'Ladmin',
                        organisation: 'organisation_system',
                        email: 'admin@example.com',
                        description: 'I am an admin user.',
                        id: adminId,
                        access: {
                            id: `user_access_obj_user_id_${adminId}`,
                            projects: [{
                                id: createdProject.id,
                                name: createdProject.name,
                                studyId: createdStudy.id
                            }],
                            studies: [{
                                id: createdStudy.id,
                                name: createdStudy.name
                            }]
                        },
                        emailNotificationsActivated: true,
                        emailNotificationsStatus: { expiringNotification: false },
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000,
                        metadata: {}
                    });
                }
                /* connecting users */
                authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, createdUserAuthorised.username, 'admin', createdUserAuthorised.otpSecret);
                authorisedUserStudy = request.agent(app);
                await connectAgent(authorisedUserStudy, createdUserAuthorisedStudy.username, 'admin', createdUserAuthorisedStudy.otpSecret);
                authorisedUserStudyManageProject = request.agent(app);
                await connectAgent(authorisedUserStudyManageProject, createdUserAuthorisedStudyManageProjects.username, 'admin', createdUserAuthorisedStudyManageProjects.otpSecret);
            });

            afterAll(async () => {
                /* project user cannot delete study */
                {
                    const res = await authorisedUser.post('/graphql').send({
                        query: print(DELETE_STUDY),
                        variables: { studyId: createdStudy.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                    expect(res.body.data.deleteStudy).toBe(null);
                }

                /* delete values in db */
                await db.collections.field_dictionary_collection.deleteMany({ studyId: createdStudy.id });
                await db.collections.data_collection.deleteMany({ studyId: createdStudy.id });
                await db.collections.files_collection.deleteMany({ studyId: createdStudy.id });

                /* study user cannot delete study */
                {
                    const res = await authorisedUserStudy.post('/graphql').send({
                        query: print(DELETE_STUDY),
                        variables: { studyId: createdStudy.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                    expect(res.body.data.deleteStudy).toBe(null);
                }

                /* admin can delete study */
                {
                    const res = await admin.post('/graphql').send({
                        query: print(DELETE_STUDY),
                        variables: { studyId: createdStudy.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.deleteStudy).toEqual({
                        id: createdStudy.id,
                        successful: true
                    });
                }

                /* check projects and roles are also deleted */
                {
                    const res = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
                    expect(res.body.data.whoAmI).toEqual({
                        username: 'admin',
                        type: enumUserTypes.ADMIN,
                        firstname: 'Fadmin',
                        lastname: 'Ladmin',
                        organisation: 'organisation_system',
                        email: 'admin@example.com',
                        description: 'I am an admin user.',
                        id: adminId,
                        access: {
                            id: `user_access_obj_user_id_${adminId}`,
                            projects: [],
                            studies: []
                        },
                        emailNotificationsActivated: true,
                        emailNotificationsStatus: { expiringNotification: false },
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000,
                        metadata: {}
                    });

                    // study data is NOT deleted for audit purposes - unless explicitly requested separately
                    const roles = await db.collections.roles_collection.find({ studyId: createdStudy.id, deleted: null }).toArray();
                    const projects = await db.collections.projects_collection.find({ studyId: createdStudy.id, deleted: null }).toArray();
                    const study = await db.collections.studies_collection.findOne({ 'id': createdStudy.id, 'life.deletedTime': null });
                    expect(roles).toEqual([]);
                    expect(projects).toEqual([]);
                    expect(study).toBe(null);
                }

                /* cannot get study from api anymore */
                {
                    const res = await admin.post('/graphql').send({
                        query: print(GET_STUDY),
                        variables: { studyId: createdStudy.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                    expect(res.body.data.getStudy).toBe(null);
                }
            });

            test('Get a non-existent study (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(GET_STUDY),
                    variables: { studyId: 'iamfake' }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                expect(res.body.data.getStudy).toBe(null);
            });

            test('Get a non-existent project (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(GET_PROJECT),
                    variables: { projectId: 'iamfake', admin: true }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                expect(res.body.data.getProject).toBe(null);
            });

            test('Get study (admin)', async () => {
                {
                    const res = await admin.post('/graphql').send({
                        query: print(GET_STUDY),
                        variables: { studyId: createdStudy.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.getStudy).toEqual({
                        id: createdStudy.id,
                        name: createdStudy.name,
                        createdBy: adminId,
                        jobs: [],
                        description: 'test description',
                        type: null,
                        projects: [
                            {
                                id: createdProject.id,
                                studyId: createdStudy.id,
                                name: createdProject.name
                            }
                        ],
                        roles: [
                            {
                                id: createdRole_study.id,
                                name: createdRole_study.name,
                                description: '',
                                permissions: {
                                    data: {
                                        fieldIds: ['^.*$'],
                                        hasVersioned: true,
                                        uploaders: ['^.*$'],
                                        operations: [atomicOperation.READ],
                                        subjectIds: ['^.*$'],
                                        visitIds: ['^.*$']
                                    },
                                    manage: {
                                        [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                        [IPermissionManagementOptions.role]: [],
                                        [IPermissionManagementOptions.job]: [],
                                        [IPermissionManagementOptions.query]: [],
                                        [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                                    }
                                },
                                studyId: createdStudy.id,
                                projectId: null,
                                users: [{
                                    id: createdUserAuthorisedStudy.id,
                                    organisation: 'organisation_system',
                                    firstname: createdUserAuthorisedStudy.firstname,
                                    lastname: createdUserAuthorisedStudy.lastname,
                                    username: createdUserAuthorisedStudy.username
                                }]
                            },
                            {
                                id: createdRole_study_manageProject.id,
                                name: createdRole_study_manageProject.name,
                                description: '',
                                permissions: {
                                    data: {
                                        fieldIds: [],
                                        hasVersioned: false,
                                        uploaders: ['^.*$'],
                                        operations: [],
                                        subjectIds: [],
                                        visitIds: []
                                    },
                                    manage: {
                                        [IPermissionManagementOptions.own]: [atomicOperation.READ, atomicOperation.WRITE],
                                        [IPermissionManagementOptions.role]: [],
                                        [IPermissionManagementOptions.job]: [],
                                        [IPermissionManagementOptions.query]: [],
                                        [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                                    }
                                },
                                studyId: createdStudy.id,
                                projectId: null,
                                users: [{
                                    id: createdUserAuthorisedStudyManageProjects.id,
                                    organisation: 'organisation_system',
                                    firstname: createdUserAuthorisedStudyManageProjects.firstname,
                                    lastname: createdUserAuthorisedStudyManageProjects.lastname,
                                    username: createdUserAuthorisedStudyManageProjects.username
                                }]
                            }
                        ],
                        files: [],
                        numOfRecords: [4, 0],
                        subjects: [['mock_patient1', 'mock_patient2'], []],
                        visits: [['mockvisitId'], []],
                        currentDataVersion: 0,
                        dataVersions: [{
                            id: 'mockDataVersionId',
                            contentId: 'mockContentId',
                            version: '0.0.1',
                            // fileSize: '10000',
                            updateDate: '5000000',
                            tag: null
                        }]
                    });
                }
                {
                    const res = await admin.post('/graphql').send({
                        query: print(GET_PROJECT),
                        variables: { projectId: createdProject.id, admin: true }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.getProject).toEqual({
                        id: createdProject.id,
                        studyId: createdStudy.id,
                        name: createdProject.name,
                        dataVersion: {
                            contentId: 'mockContentId',
                            id: 'mockDataVersionId',
                            tag: null,
                            updateDate: '5000000',
                            version: '0.0.1'
                        },
                        summary: {
                            subjects: [
                                'mock_patient1',
                                'mock_patient2'
                            ],
                            visits: [
                                'mockvisitId'
                            ],
                            standardizationTypes: []
                        },
                        jobs: [],
                        roles: [
                            {
                                id: createdRole_project.id,
                                name: createdRole_project.name,
                                description: '',
                                permissions: {
                                    data: {
                                        fieldIds: ['^.*$'],
                                        hasVersioned: false,
                                        uploaders: ['^.*$'],
                                        operations: [atomicOperation.READ],
                                        subjectIds: ['^.*$'],
                                        visitIds: ['^.*$']
                                    },
                                    manage: {
                                        [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                        [IPermissionManagementOptions.role]: [],
                                        [IPermissionManagementOptions.job]: [],
                                        [IPermissionManagementOptions.query]: [],
                                        [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                                    }
                                },
                                projectId: createdProject.id,
                                studyId: createdStudy.id,
                                users: [{
                                    id: createdUserAuthorised.id,
                                    organisation: 'organisation_system',
                                    firstname: createdUserAuthorised.firstname,
                                    lastname: createdUserAuthorised.lastname,
                                    username: createdUserAuthorised.username
                                }]
                            }
                        ],
                        iCanEdit: true,
                        fields: [],
                        files: []
                    });
                }
            });

            test('Get study (user without privilege)', async () => {
                const res = await user.post('/graphql').send({
                    query: print(GET_STUDY),
                    variables: { studyId: createdStudy.id }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.getStudy).toBe(null);
            });

            test('Get study (user with privilege)', async () => {
                {
                    const res = await authorisedUser.post('/graphql').send({
                        query: print(GET_STUDY),
                        variables: { studyId: createdStudy.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                    expect(res.body.data.getStudy).toEqual(null);
                }
                {
                    const res = await authorisedUser.post('/graphql').send({
                        query: print(GET_PROJECT),
                        variables: { projectId: createdProject.id, admin: false }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.getProject).toEqual({
                        id: createdProject.id,
                        studyId: createdStudy.id,
                        name: createdProject.name,
                        jobs: [],
                        iCanEdit: true,
                        fields: [],
                        files: [],
                        dataVersion: {
                            contentId: 'mockContentId',
                            id: 'mockDataVersionId',
                            tag: null,
                            updateDate: '5000000',
                            version: '0.0.1'
                        },
                        summary: {
                            subjects: [
                                'mock_patient1',
                                'mock_patient2'
                            ],
                            visits: [
                                'mockvisitId'
                            ],
                            standardizationTypes: []
                        }
                    });
                }
            });

            test('Get study fields (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(GET_STUDY_FIELDS),
                    variables: {
                        studyId: createdStudy.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.getStudyFields.sort((a: { id: string; }, b: { id: any; }) => a.id.localeCompare(b.id))).toEqual([ // as the api will sort the results, the order is changed
                    {
                        id: 'mockfield2',
                        studyId: createdStudy.id,
                        fieldId: '32',
                        fieldName: 'Race',
                        tableName: null,
                        dataType: 'str',
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dateAdded: '20000',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    },
                    {
                        id: 'mockfield1',
                        studyId: createdStudy.id,
                        fieldId: '31',
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: 'str',
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dateAdded: '10000',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    }
                ].sort((a, b) => a.id.localeCompare(b.id)));
            });

            test('Get study fields (user project privilege)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(GET_STUDY_FIELDS),
                    variables: {
                        studyId: createdStudy.id,
                        projectId: createdProject.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.getStudyFields.sort((a: { id: string; }, b: { id: any; }) => a.id.localeCompare(b.id))).toEqual([ // as the api will sort the results, the order is changed
                    {
                        id: 'mockfield1',
                        studyId: createdStudy.id,
                        fieldId: '31',
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: 'str',
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dateAdded: '10000',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    },
                    {
                        id: 'mockfield2',
                        studyId: createdStudy.id,
                        fieldId: '32',
                        fieldName: 'Race',
                        tableName: null,
                        dataType: 'str',
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dateAdded: '20000',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    }
                ].sort((a, b) => a.id.localeCompare(b.id)));
            });

            test('Get study fields (user without project privilege nor study privilege) (should fail)', async () => {
                const res = await user.post('/graphql').send({
                    query: print(GET_STUDY_FIELDS),
                    variables: {
                        studyId: createdStudy.id,
                        projectId: createdProject.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.getStudyFields).toBe(null);
            });

            test('Get study fields, with unversioned fields', async () => {
                // delete an exisiting field and add a new field
                await db.collections.field_dictionary_collection.insertOne({
                    id: 'mockfield2_deleted',
                    studyId: createdStudy.id,
                    fieldId: '32',
                    fieldName: 'Race',
                    dataType: enumDataTypes.STRING,
                    categoricalOptions: [],
                    unit: 'person',
                    comments: 'mockComments1',
                    dataVersion: null,
                    life: {
                        createdTime: 30000,
                        createdUserId: 'admin',
                        deletedTime: 30000,
                        deletedUserId: 'admin'
                    },
                    metadata: {}
                });

                await db.collections.field_dictionary_collection.insertOne({
                    id: 'mockfield3',
                    studyId: createdStudy.id,
                    fieldId: '33',
                    fieldName: 'Weight',
                    dataType: enumDataTypes.DECIMAL,
                    categoricalOptions: [],
                    unit: 'kg',
                    comments: 'mockComments3',
                    dataVersion: null,
                    life: {
                        createdTime: 30000,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUserId: null
                    },
                    metadata: {}
                });

                // user with study privilege can access all latest field, including unversioned
                const res = await authorisedUserStudy.post('/graphql').send({
                    query: print(GET_STUDY_FIELDS),
                    variables: {
                        studyId: createdStudy.id,
                        projectId: createdProject.id,
                        versionId: null
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.getStudyFields.map(el => el.id).sort()).toEqual(['mockfield1', 'mockfield3']);
                // user with project privilege can only access the latest fields that are versioned
                const res2 = await authorisedUser.post('/graphql').send({
                    query: print(GET_STUDY_FIELDS),
                    variables: {
                        studyId: createdStudy.id,
                        projectId: createdProject.id
                    }
                });
                expect(res2.status).toBe(200);
                expect(res2.body.errors).toBeUndefined();
                expect(res2.body.data.getStudyFields.sort((a: { id: string; }, b: { id: any; }) => a.id.localeCompare(b.id))).toEqual([ // as the api will sort the results, the order is changed
                    {
                        id: 'mockfield2',
                        studyId: createdStudy.id,
                        fieldId: '32',
                        fieldName: 'Race',
                        tableName: null,
                        dataType: 'str',
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dateAdded: '20000',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    },
                    {
                        id: 'mockfield1',
                        studyId: createdStudy.id,
                        fieldId: '31',
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: 'str',
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dateAdded: '10000',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    }
                ].sort((a, b) => a.id.localeCompare(b.id)));
                // clear database
                await db.collections.field_dictionary_collection.deleteMany({ dataVersion: null });
            });

            test('Set a previous study dataversion as current (admin)', async () => {
                /* setup: add an extra dataversion */
                await db.collections.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });
                const res = await admin.post('/graphql').send({
                    query: print(SET_DATAVERSION_AS_CURRENT),
                    variables: {
                        studyId: createdStudy.id,
                        dataVersionId: mockDataVersion.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                const study = await db.collections.studies_collection.findOne<IStudy>({ id: createdStudy.id }, { projection: { dataVersions: 1 } });
                expect(study).toBeDefined();
                expect(res.body.data.setDataversionAsCurrent).toEqual({
                    id: createdStudy.id,
                    currentDataVersion: 0,
                    dataVersions: [
                        { ...mockDataVersion, tag: null },
                        { ...newMockDataVersion }
                    ]
                });

                /* cleanup: reverse setting dataversion */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection)
                    .updateOne({ id: createdStudy.id }, { $set: { dataVersions: [mockDataVersion], currentDataVersion: 0 } });
            });

            test('Set a previous study dataversion as current (user without privilege) (should fail)', async () => {
                /* setup: add an extra dataversion */
                await db.collections.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

                const res = await user.post('/graphql').send({
                    query: print(SET_DATAVERSION_AS_CURRENT),
                    variables: {
                        studyId: createdStudy.id,
                        dataVersionId: mockDataVersion.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.data.setDataversionAsCurrent).toEqual(null);

                /* cleanup: reverse setting dataversion */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection)
                    .updateOne({ id: createdStudy.id }, { $set: { dataVersions: [mockDataVersion], currentDataVersion: 0 } });
            });

            test('Set a previous study dataversion as current (user with project privilege) (should fail)', async () => {
                /* setup: add an extra dataversion */
                await db.collections.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

                const res = await authorisedUser.post('/graphql').send({
                    query: print(SET_DATAVERSION_AS_CURRENT),
                    variables: {
                        studyId: createdStudy.id,
                        dataVersionId: mockDataVersion.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.data.setDataversionAsCurrent).toEqual(null);

                /* cleanup: reverse setting dataversion */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection)
                    .updateOne({ id: createdStudy.id }, { $set: { dataVersions: [mockDataVersion], currentDataVersion: 0 } });
            });

            test('Set a previous study dataversion as current (user with study read-only privilege) (should fail)', async () => {
                /* setup: add an extra dataversion */
                await db.collections.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

                const res = await authorisedUserStudy.post('/graphql').send({
                    query: print(SET_DATAVERSION_AS_CURRENT),
                    variables: {
                        studyId: createdStudy.id,
                        dataVersionId: mockDataVersion.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.data.setDataversionAsCurrent).toEqual(null);

                /* cleanup: reverse setting dataversion */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection)
                    .updateOne({ id: createdStudy.id }, { $set: { dataVersions: [mockDataVersion], currentDataVersion: 0 } });
            });

            test('Set a previous study dataversion as current (user with study "manage project" privilege)', async () => {
                /* setup: add an extra dataversion */
                await db.collections.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

                const res = await authorisedUserStudyManageProject.post('/graphql').send({
                    query: print(SET_DATAVERSION_AS_CURRENT),
                    variables: {
                        studyId: createdStudy.id,
                        dataVersionId: mockDataVersion.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.setDataversionAsCurrent.currentDataVersion).toBe(0);

                /* cleanup: reverse setting dataversion */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection)
                    .updateOne({ id: createdStudy.id }, { $set: { dataVersions: [mockDataVersion], currentDataVersion: 0 } });
            });

            test('Set a previous study dataversion as current (user with study "manage data" privilege) (should fail)', async () => {
                /* setup: create a new user */
                const userDataCurator: IUser = {
                    id: uuid(),
                    username: 'datacurator',
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: 'user@ic.ac.uk',
                    firstname: 'FDataCurator',
                    lastname: 'LDataCurator',
                    organisation: 'organisation_system',
                    type: enumUserTypes.STANDARD,
                    description: 'just a data curator',
                    resetPasswordRequests: [],
                    emailNotificationsActivated: true,
                    emailNotificationsStatus: { expiringNotification: false },
                    expiredAt: 1991134065000,
                    life: {
                        createdTime: 1591134065000,
                        createdUser: enumReservedUsers.SYSTEM,
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await db.collections.users_collection.insertOne(userDataCurator);

                /* setup: create a new role with data management */
                const roleDataCurator: any = {
                    id: uuid(),
                    studyId: createdStudy.id,
                    name: 'Data Manager',
                    permissions: {
                        data: {
                            fieldIds: ['^.*$'],
                            hasVersioned: true,
                            uploaders: ['^.*$'],
                            operations: [atomicOperation.READ, atomicOperation.WRITE],
                            subjectIds: ['^.*$'],
                            visitIds: ['^.*$']
                        },
                        manage: {
                            [IPermissionManagementOptions.own]: [atomicOperation.READ],
                            [IPermissionManagementOptions.role]: [],
                            [IPermissionManagementOptions.job]: [],
                            [IPermissionManagementOptions.query]: [],
                            [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                        }
                    },
                    users: [userDataCurator.id],
                    createdBy: adminId,
                    deleted: null
                };
                await db.collections.roles_collection.insertOne(roleDataCurator);

                /* setup: connect user */
                const dataCurator = request.agent(app);
                await connectAgent(dataCurator, userDataCurator.username, 'admin', userDataCurator.otpSecret);

                /* setup: add an extra dataversion */
                await db.collections.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

                /* test */
                const res = await dataCurator.post('/graphql').send({
                    query: print(SET_DATAVERSION_AS_CURRENT),
                    variables: {
                        studyId: createdStudy.id,
                        dataVersionId: mockDataVersion.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);

                /* cleanup: reverse setting dataversion */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection)
                    .updateOne({ id: createdStudy.id }, { $set: { dataVersions: [mockDataVersion], currentDataVersion: 0 } });

                /* cleanup: delete user and role */
                await db.collections.users_collection.deleteOne({ id: userDataCurator.id });
                await db.collections.roles_collection.deleteOne({ id: roleDataCurator.id });
            });

            test('Create New fields (admin)', async () => {
                await db.collections.field_dictionary_collection.deleteMany({ dataVersion: null });
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_NEW_FIELD),
                    variables: {
                        studyId: createdStudy.id,
                        fieldInput: [
                            {
                                fieldId: '8',
                                fieldName: 'newField8',
                                tableName: 'test',
                                dataType: 'int',
                                comments: 'test',
                                possibleValues: [
                                    { code: '1', description: 'NOW' },
                                    { code: '2', description: 'OLD' }
                                ]
                            },
                            {
                                fieldId: '9',
                                fieldName: 'newField9',
                                tableName: 'test',
                                dataType: 'cat',
                                comments: 'test',
                                possibleValues: [
                                    { code: '1', description: 'TRUE' },
                                    { code: '2', description: 'FALSE' }
                                ]
                            }
                        ]
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.createNewField).toEqual([
                    { successful: true, code: null, id: null, description: 'Field 8-newField8 is created successfully.' },
                    { successful: true, code: null, id: null, description: 'Field 9-newField9 is created successfully.' }
                ]);
                const fieldsInDb = await db.collections.field_dictionary_collection.find({ studyId: createdStudy.id, dataVersion: null }).toArray();
                expect(fieldsInDb).toHaveLength(2);
            });

            test('Create New field with unsupported characters (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_NEW_FIELD),
                    variables: {
                        studyId: createdStudy.id,
                        fieldInput: [
                            {
                                fieldId: '8.2',
                                fieldName: 'newField8',
                                tableName: 'test',
                                dataType: 'int',
                                comments: 'test',
                                possibleValues: [
                                    { code: '1', description: 'NOW' },
                                    { code: '2', description: 'OLD' }
                                ]
                            }
                        ]
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.createNewField[0]).toEqual({
                    id: null,
                    successful: false,
                    code: 'CLIENT_MALFORMED_INPUT',
                    description: 'Field 8.2-newField8: ["FieldId should contain letters, numbers and _ only."]'
                });
            });

            test('Create New fields (user, should fail)', async () => {
                const res = await user.post('/graphql').send({
                    query: print(CREATE_NEW_FIELD),
                    variables: {
                        studyId: createdStudy.id,
                        fieldInput: [
                            {
                                fieldId: '8',
                                fieldName: 'newField8',
                                tableName: 'test',
                                dataType: 'int',
                                comments: 'test',
                                possibleValues: [
                                    { code: '1', description: 'NOW' },
                                    { code: '2', description: 'OLD' }
                                ]
                            },
                            {
                                fieldId: '9',
                                fieldName: 'newField9',
                                tableName: 'test',
                                dataType: 'cat',
                                comments: 'test',
                                possibleValues: [
                                    { code: '1', description: 'TRUE' },
                                    { code: '2', description: 'FALSE' }
                                ]
                            }
                        ]
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            });

            test('Delete an unversioned field (admin)', async () => {
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_FIELD),
                    variables: {
                        studyId: createdStudy.id,
                        fieldInput: [
                            {
                                fieldId: '8',
                                fieldName: 'newField8',
                                tableName: 'test',
                                dataType: 'int',
                                comments: 'test',
                                possibleValues: [
                                    { code: '1', description: 'NOW' },
                                    { code: '2', description: 'OLD' }
                                ]
                            },
                            {
                                fieldId: '9',
                                fieldName: 'newField9',
                                tableName: 'test',
                                dataType: 'cat',
                                comments: 'test',
                                possibleValues: [
                                    { code: '1', description: 'TRUE' },
                                    { code: '2', description: 'FALSE' }
                                ]
                            }
                        ]
                    }
                });
                const res = await admin.post('/graphql').send({
                    query: print(DELETE_FIELD),
                    variables: {
                        studyId: createdStudy.id,
                        fieldId: '8'
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.deleteField.fieldId).toBe('8');
                const fieldsInDb = await db.collections.field_dictionary_collection.find({ 'studyId': createdStudy.id, 'life.deletedTime': { $ne: null } }).toArray();
                expect(fieldsInDb).toHaveLength(1);
                expect(fieldsInDb[0].fieldId).toBe('8');
                // clear database
                await db.collections.field_dictionary_collection.deleteMany({ studyId: createdStudy.id, fieldId: { $in: ['8', '9'] } });
            });

            test('Delete a versioned field (admin)', async () => {
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_FIELD),
                    variables: {
                        studyId: createdStudy.id,
                        fieldInput: [
                            {
                                fieldId: '8',
                                fieldName: 'newField8',
                                tableName: 'test',
                                dataType: 'int',
                                comments: 'test',
                                possibleValues: [
                                    { code: '1', description: 'NOW' },
                                    { code: '2', description: 'OLD' }
                                ]
                            },
                            {
                                fieldId: '9',
                                fieldName: 'newField9',
                                tableName: 'test',
                                dataType: 'cat',
                                comments: 'test',
                                possibleValues: [
                                    { code: '1', description: 'TRUE' },
                                    { code: '2', description: 'FALSE' }
                                ]
                            }
                        ]
                    }
                });
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                const res = await admin.post('/graphql').send({
                    query: print(DELETE_FIELD),
                    variables: {
                        studyId: createdStudy.id,
                        fieldId: '8'
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.deleteField.fieldId).toBe('8');
                const fieldsInDb = await db.collections.field_dictionary_collection.find({ studyId: createdStudy.id, fieldId: '8' }).toArray();
                expect(fieldsInDb).toHaveLength(2);
                expect(fieldsInDb[0].fieldId).toBe('8');
                expect(fieldsInDb[1].fieldId).toBe('8');
                expect(fieldsInDb[1].dateDeleted).not.toBe(null);
                // clear database
                await db.collections.field_dictionary_collection.deleteMany({ studyId: createdStudy.id, fieldId: { $in: ['8', '9'] } });
            });
        });

        describe('UPLOAD/DELETE DATA RECORDS DIRECTLY VIA API', () => {
            let createdStudy: { id: any; name: any; };
            let createdProject: { id: any; name: any; studyId: any; };
            let createdRole_study_accessData;
            let createdRole_project;
            let createdUserAuthorisedProject;  // profile
            let createdUserNoAuthorisedProfile;
            let createdUserAuthorisedProfile;
            let authorisedUser: request.SuperTest<request.Test>;
            let authorisedProjectUser: request.SuperTest<request.Test>;
            let unauthorisedUser: request.SuperTest<request.Test>;
            let mockFields: IField[];
            let mockDataVersion: IStudyDataVersion;
            const fieldTreeId = uuid();
            const oneRecord = [{
                fieldId: '31',
                value: '10',
                subjectId: 'I7N3G6G',
                visitId: '1'
            }];
            const multipleRecords = [
                {
                    fieldId: '31',
                    value: '10',
                    subjectId: 'I7N3G6G',
                    visitId: '1'
                },
                {
                    fieldId: '32',
                    value: 'AAA',
                    subjectId: 'I7N3G6G',
                    visitId: '1'
                },
                {
                    fieldId: '31',
                    value: '102',
                    subjectId: 'I7N3G6G',
                    visitId: '2'
                },
                {
                    fieldId: '32',
                    value: 'AAAA',
                    subjectId: 'I7N3G6G',
                    visitId: '2'
                },
                {
                    fieldId: '31',
                    value: '11',
                    subjectId: 'GR6R4AR',
                    visitId: '2'
                },
                {
                    fieldId: '32',
                    value: 'BBB',
                    subjectId: 'GR6R4AR',
                    visitId: '2'
                }
            ];

            beforeAll(async () => {
                /*** setup: create a setup study ***/
                /* 1. create study */
                {
                    const studyName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(CREATE_STUDY),
                        variables: { name: studyName, description: 'test description', type: studyType.SENSOR }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    createdStudy = await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOne({ name: studyName });
                    expect(res.body.data.createStudy).toEqual({
                        id: createdStudy.id,
                        name: studyName,
                        description: 'test description',
                        type: studyType.SENSOR
                    });
                }

                /* 2. create a role for study (it will have 'access study data' privilege - equivalent to PI */
                {
                    const roleName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(ADD_NEW_ROLE),
                        variables: {
                            roleName,
                            studyId: createdStudy.id
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();

                    createdRole_study_accessData = await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ name: roleName });
                    expect(createdRole_study_accessData).toEqual({
                        _id: createdRole_study_accessData._id,
                        id: createdRole_study_accessData.id,
                        studyId: createdStudy.id,
                        projectId: null,
                        name: roleName,
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        createdBy: adminId,
                        users: [],
                        deleted: null,
                        metadata: {},
                        description: ''
                    });
                    expect(res.body.data.addRole).toEqual({
                        id: createdRole_study_accessData.id,
                        name: roleName,
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        studyId: createdStudy.id,
                        projectId: null,
                        users: []
                    });
                }

                /* 3. create an general study user that cannot manage projects (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: enumUserTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}'@user.io'`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised study user managing project.',
                        emailNotificationsActivated: true,
                        emailNotificationsStatus: { expiringNotification: false },
                        organisation: 'organisation_system',
                        id: `AuthorisedStudyUserManageProject_${username}`,
                        expiredAt: 1991134065000,
                        life: {
                            createdTime: 1591134065000,
                            createdUser: enumReservedUsers.SYSTEM,
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {}
                    };

                    await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
                    createdUserNoAuthorisedProfile = await mongoClient.collection<IUser>(config.database.collections.users_collection).findOne({ username });
                }

                /* 3. create an authorised study user that can manage projects (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: enumUserTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}'@user.io'`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised study user managing project.',
                        emailNotificationsActivated: true,
                        emailNotificationsStatus: { expiringNotification: false },
                        organisation: 'organisation_system',
                        metadata: {
                            wp: 'wp5.1'
                        },
                        id: `AuthorisedStudyUserManageProject_${username}`,
                        expiredAt: 1991134065000,
                        life: {
                            createdTime: 1591134065000,
                            createdUser: enumReservedUsers.SYSTEM,
                            deletedTime: null,
                            deletedUser: null
                        }
                    };

                    await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
                    createdUserAuthorisedProfile = await mongoClient.collection<IUser>(config.database.collections.users_collection).findOne({ username });
                }

                /* 4. add authorised user to role */
                {
                    const res = await admin.post('/graphql').send({
                        query: print(EDIT_ROLE),
                        variables: {
                            roleId: createdRole_study_accessData.id,
                            userChanges: {
                                add: [createdUserAuthorisedProfile.id],
                                remove: []
                            },
                            permissionChanges: {
                                data: {
                                    fieldIds: ['^.*$'],
                                    hasVersioned: true,
                                    uploaders: ['^.*$'],
                                    operations: [atomicOperation.READ, atomicOperation.WRITE],
                                    subjectIds: ['^.*$'],
                                    visitIds: ['^.*$']
                                },
                                manage: {
                                    [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                    [IPermissionManagementOptions.role]: [],
                                    [IPermissionManagementOptions.job]: [],
                                    [IPermissionManagementOptions.query]: [],
                                    [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ, atomicOperation.WRITE]
                                }
                            }
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.editRole).toEqual({
                        id: createdRole_study_accessData.id,
                        name: createdRole_study_accessData.name,
                        studyId: createdStudy.id,
                        projectId: null,
                        description: '',
                        permissions: {
                            data: {
                                fieldIds: ['^.*$'],
                                hasVersioned: true,
                                uploaders: ['^.*$'],
                                operations: [atomicOperation.READ, atomicOperation.WRITE],
                                subjectIds: ['^.*$'],
                                visitIds: ['^.*$']
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ, atomicOperation.WRITE]
                            }
                        },
                        users: [{
                            id: createdUserAuthorisedProfile.id,
                            organisation: 'organisation_system',
                            firstname: createdUserAuthorisedProfile.firstname,
                            lastname: createdUserAuthorisedProfile.lastname
                        }]
                    });
                    const resUser = await admin.post('/graphql').send({
                        query: print(GET_USERS),
                        variables: {
                            fetchDetailsAdminOnly: false,
                            userId: createdUserAuthorisedProfile.id,
                            fetchAccessPrivileges: true
                        }
                    });
                    expect(resUser.status).toBe(200);
                    expect(resUser.body.errors).toBeUndefined();
                    expect(resUser.body.data.getUsers).toHaveLength(1);
                    expect(resUser.body.data.getUsers[0]).toEqual({
                        id: createdUserAuthorisedProfile.id,
                        type: enumUserTypes.STANDARD,
                        firstname: `${createdUserAuthorisedProfile.username}_firstname`,
                        lastname: `${createdUserAuthorisedProfile.username}_lastname`,
                        organisation: 'organisation_system',
                        access: {
                            id: `user_access_obj_user_id_${createdUserAuthorisedProfile.id}`,
                            projects: [],
                            studies: [{
                                id: createdStudy.id,
                                name: createdStudy.name
                            }]
                        }
                    });
                }

                /* 5. Insert field for data uploading later */
                mockDataVersion = {
                    id: 'mockDataVersionId',
                    contentId: 'mockContentId',
                    version: '0.0.1',
                    updateDate: '5000000'
                };
                mockFields = [
                    {
                        id: 'mockfield1',
                        studyId: createdStudy.id,
                        fieldId: '31',
                        fieldName: 'Age',
                        dataType: enumDataTypes.INTEGER,
                        categoricalOptions: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dataVersion: 'mockDataVersionId',
                        life: {
                            createdTime: 100000000,
                            createdUser: 'admin',
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {}
                    },
                    {
                        id: 'mockfield2',
                        studyId: createdStudy.id,
                        fieldId: '32',
                        fieldName: 'Sex',
                        dataType: enumDataTypes.STRING,
                        categoricalOptions: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dataVersion: 'mockDataVersionId',
                        life: {
                            createdTime: 100000001,
                            createdUser: 'admin',
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {}
                    },
                    {
                        id: 'mockfield3',
                        studyId: createdStudy.id,
                        fieldId: '33',
                        fieldName: 'DeviceTest',
                        dataType: enumDataTypes.FILE,
                        categoricalOptions: [],
                        unit: 'person',
                        comments: 'mockComments3',
                        dataVersion: 'mockDataVersionId',
                        life: {
                            createdTime: 100000002,
                            createdUser: 'admin',
                            deletedTime: null,
                            deletedUser: null
                        },
                        metadata: {}
                    }
                ];
                await db.collections.studies_collection.updateOne({ id: createdStudy.id }, {
                    $push: { dataVersions: mockDataVersion },
                    $inc: { currentDataVersion: 1 },
                    $set: {
                        ontologyTrees: [{
                            id: 'testOntology_id',
                            name: 'testOntology',
                            routes: [
                                {
                                    path: [
                                        'MO',
                                        'MOCK'
                                    ],
                                    name: 'mockfield1',
                                    field: [
                                        '$31'
                                    ],
                                    visitRange: [],
                                    id: '036b7772-f239-4fef-b7f8-c3db883f51e3'
                                },
                                {
                                    path: [
                                        'MO',
                                        'MOCK'
                                    ],
                                    name: 'mockfield2',
                                    field: [
                                        '$32'
                                    ],
                                    visitRange: [],
                                    id: 'f577023f-de54-446a-9bbe-1c346823e6bf'
                                }
                            ]
                        }]
                    }
                });

                /* 2. create projects for the study */
                {
                    const projectName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(CREATE_PROJECT),
                        variables: {
                            studyId: createdStudy.id,
                            projectName: projectName,
                            dataVersion: mockDataVersion.id
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    createdProject = await mongoClient.collection<IProject>(config.database.collections.projects_collection).findOne({ name: projectName });
                    expect(res.body.data.createProject).toEqual({
                        id: createdProject.id,
                        studyId: createdStudy.id,
                        name: projectName
                    });
                }

                /* 5. create an authorised project user (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: enumUserTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}@user.io`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised project user.',
                        emailNotificationsActivated: true,
                        emailNotificationsStatus: { expiringNotification: false },
                        organisation: 'organisation_system',
                        metadata: {
                            wp: 'wp5.2'
                        },
                        id: `AuthorisedProjectUser_${username}`,
                        expiredAt: 1991134065000,
                        life: {
                            createdTime: 1591134065000,
                            createdUser: enumReservedUsers.SYSTEM,
                            deletedTime: null,
                            deletedUser: null
                        }
                    };
                    await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
                    createdUserAuthorisedProject = await mongoClient.collection<IUser>(config.database.collections.users_collection).findOne({ username });
                }

                /* 4. create roles for project */
                {
                    const roleName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(ADD_NEW_ROLE),
                        variables: {
                            roleName,
                            studyId: createdStudy.id,
                            projectId: createdProject.id
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    createdRole_project = await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ name: roleName });
                    expect(createdRole_project).toEqual({
                        _id: createdRole_project._id,
                        id: createdRole_project.id,
                        projectId: createdProject.id,
                        studyId: createdStudy.id,
                        name: roleName,
                        description: '',
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        createdBy: adminId,
                        users: [],
                        deleted: null,
                        metadata: {}
                    });
                    expect(res.body.data.addRole).toEqual({
                        id: createdRole_project.id,
                        name: roleName,
                        permissions: {
                            data: {
                                fieldIds: [],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [],
                                subjectIds: [],
                                visitIds: []
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        studyId: createdStudy.id,
                        projectId: createdProject.id,
                        users: []
                    });
                }

                /* 6. add authorised user to role */
                {
                    const res = await admin.post('/graphql').send({
                        query: print(EDIT_ROLE),
                        variables: {
                            roleId: createdRole_project.id,
                            userChanges: {
                                add: [createdUserAuthorisedProject.id],
                                remove: []
                            },
                            permissionChanges: {
                                data: {
                                    fieldIds: ['^.*$'],
                                    hasVersioned: false,
                                    uploaders: ['^.*$'],
                                    operations: [atomicOperation.READ],
                                    subjectIds: ['^.*$'],
                                    visitIds: ['^.*$']
                                },
                                manage: {
                                    [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                    [IPermissionManagementOptions.role]: [],
                                    [IPermissionManagementOptions.job]: [],
                                    [IPermissionManagementOptions.query]: [],
                                    [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                                }
                            }
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.editRole).toEqual({
                        id: createdRole_project.id,
                        name: createdRole_project.name,
                        studyId: createdStudy.id,
                        projectId: createdProject.id,
                        description: '',
                        permissions: {
                            data: {
                                fieldIds: ['^.*$'],
                                hasVersioned: false,
                                uploaders: ['^.*$'],
                                operations: [atomicOperation.READ],
                                subjectIds: ['^.*$'],
                                visitIds: ['^.*$']
                            },
                            manage: {
                                [IPermissionManagementOptions.own]: [atomicOperation.READ],
                                [IPermissionManagementOptions.role]: [],
                                [IPermissionManagementOptions.job]: [],
                                [IPermissionManagementOptions.query]: [],
                                [IPermissionManagementOptions.ontologyTrees]: [atomicOperation.READ]
                            }
                        },
                        users: [{
                            id: createdUserAuthorisedProject.id,
                            organisation: 'organisation_system',
                            firstname: createdUserAuthorisedProject.firstname,
                            lastname: createdUserAuthorisedProject.lastname
                        }]
                    });
                    const resUser = await admin.post('/graphql').send({
                        query: print(GET_USERS),
                        variables: {
                            fetchDetailsAdminOnly: false,
                            userId: createdUserAuthorisedProject.id,
                            fetchAccessPrivileges: true
                        }
                    });
                    expect(resUser.status).toBe(200);
                    expect(resUser.body.errors).toBeUndefined();
                    expect(resUser.body.data.getUsers).toHaveLength(1);
                    expect(resUser.body.data.getUsers[0]).toEqual({
                        id: createdUserAuthorisedProject.id,
                        type: enumUserTypes.STANDARD,
                        firstname: `${createdUserAuthorisedProject.username}_firstname`,
                        lastname: `${createdUserAuthorisedProject.username}_lastname`,
                        organisation: 'organisation_system',
                        access: {
                            id: `user_access_obj_user_id_${createdUserAuthorisedProject.id}`,
                            projects: [{
                                id: createdProject.id,
                                name: createdProject.name,
                                studyId: createdStudy.id
                            }],
                            studies: []
                        }
                    });
                }

                /* 7. Create an ontologytree */
                {
                    await db.collections.studies_collection.findOneAndUpdate({ id: createdStudy.id }, {
                        $set: {
                            ontologyTrees: [{
                                id: uuid(),
                                name: 'testOntologyTree',
                                routes: [
                                    { path: ['DM'], name: 'AGE', field: ['$31'], visitRange: [], id: uuid() },
                                    { path: ['DM'], name: 'SEX', field: ['$32'], visitRange: [], id: uuid() }
                                ],
                                dataVersion: mockDataVersion.id,
                                deleted: null
                            }]
                        }
                    });
                }
                const study_role_id = `metadata.${'role:'.concat(createdRole_study_accessData?.id)}`;
                const project_role_id = `metadata.${'role:'.concat(createdRole_project?.id)}`;
                await db.collections.field_dictionary_collection.updateMany({ studyId: createdStudy.id }, {
                    $set: {
                        [study_role_id]: true,
                        [project_role_id]: true
                    }
                });

                /* Connect users */
                authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, createdUserAuthorisedProfile.username, 'admin', createdUserAuthorisedProfile.otpSecret);
                unauthorisedUser = request.agent(app);
                await connectAgent(unauthorisedUser, createdUserNoAuthorisedProfile.username, 'admin', createdUserNoAuthorisedProfile.otpSecret);
                authorisedProjectUser = request.agent(app);
                await connectAgent(authorisedProjectUser, createdUserAuthorisedProject.username, 'admin', createdUserAuthorisedProject.otpSecret);

            });

            afterAll(async () => {
                {
                    const res = await admin.post('/graphql').send({
                        query: print(DELETE_STUDY),
                        variables: { studyId: createdStudy.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.deleteStudy).toEqual({
                        id: createdStudy.id,
                        successful: true
                    });
                }

                {
                    const res = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
                    expect(res.body.data.whoAmI).toEqual({
                        username: 'admin',
                        type: enumUserTypes.ADMIN,
                        firstname: 'Fadmin',
                        lastname: 'Ladmin',
                        organisation: 'organisation_system',
                        email: 'admin@example.com',
                        description: 'I am an admin user.',
                        id: adminId,
                        access: {
                            id: `user_access_obj_user_id_${adminId}`,
                            projects: [],
                            studies: []
                        },
                        emailNotificationsActivated: true,
                        emailNotificationsStatus: { expiringNotification: false },
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000,
                        metadata: {}
                    });

                    // study data is NOT deleted for audit purposes - unless explicitly requested separately
                    const roles = await db.collections.roles_collection.find({ studyId: createdStudy.id, deleted: null }).toArray();
                    const projects = await db.collections.projects_collection.find({ studyId: createdStudy.id, deleted: null }).toArray();
                    const study = await db.collections.studies_collection.findOne({ 'id': createdStudy.id, 'life.deletedTime': null });
                    expect(roles).toEqual([]);
                    expect(projects).toEqual([]);
                    expect(study).toBe(null);
                }

                /* cannot get study from api anymore */
                {
                    const res = await admin.post('/graphql').send({
                        query: print(GET_STUDY),
                        variables: { studyId: createdStudy.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                    expect(res.body.data.getStudy).toBe(null);
                }

                await db.collections.field_dictionary_collection.deleteMany({ studyId: createdStudy.id });
            });

            beforeEach(async () => {
                await db.collections.field_dictionary_collection.insertMany(mockFields);
            });

            afterEach(async () => {
                await db.collections.data_collection.deleteMany({});
                await db.collections.studies_collection.findOneAndUpdate({ id: createdStudy.id }, {
                    $set: {
                        dataVersions: [{
                            id: 'mockDataVersionId',
                            contentId: 'mockContentId',
                            version: '0.0.1',
                            updateDate: '5000000'
                        }], currentDataVersion: 0
                    }
                });
                await db.collections.field_dictionary_collection.deleteMany({});
            });

            test('Upload a data record to study (authorised user)', async () => {
                const recordList = [
                    {
                        fieldId: '31',
                        value: '10',
                        subjectId: 'I7N3G6G',
                        visitId: '1'
                    },
                    {
                        fieldId: '32',
                        value: 'FAKE1',
                        subjectId: 'I7N3G6G',
                        visitId: '1'
                    },
                    {
                        fieldId: '31',
                        value: '11',
                        subjectId: 'GR6R4AR',
                        visitId: '1'
                    },
                    // non-existing field
                    {
                        fieldId: '34',
                        value: '10',
                        subjectId: 'I7N3G6G',
                        visitId: '1'
                    },
                    // illegal value
                    {
                        fieldId: '31',
                        value: 'wrong',
                        subjectId: 'I7N3G6G',
                        visitId: '2'
                    },
                    // illegal subject id
                    {
                        fieldId: '31',
                        value: '10',
                        subjectId: 'I777770',
                        visitId: '1'
                    }
                ];
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: recordList }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.uploadDataInArray).toEqual([
                    { code: null, description: 'I7N3G6G-1-31', id: null, successful: true },
                    { code: null, description: 'I7N3G6G-1-32', id: null, successful: true },
                    { code: null, description: 'GR6R4AR-1-31', id: null, successful: true },
                    { code: 'CLIENT_ACTION_ON_NON_EXISTENT_ENTRY', description: 'Field 34: Field Not found', id: null, successful: false },
                    { code: 'CLIENT_MALFORMED_INPUT', description: 'Field 31: Cannot parse as integer.', id: null, successful: false },
                    { code: 'CLIENT_MALFORMED_INPUT', description: 'Subject ID I777770 is illegal.', id: null, successful: false }
                ]);

                const dataInDb = await db.collections.data_collection.find({ 'life.deletedTime': null }).toArray();
                expect(dataInDb).toHaveLength(3);
            });

            test('Upload a data record to study (unauthorised user)', async () => {
                const res = await unauthorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: oneRecord }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            });

            test('Upload a data record with incorrect studyId', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: 'fakeStudyId', fieldTreeId: fieldTreeId, data: oneRecord }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe('Study does not exist.');
            });

            test('Upload a file with the data API', async () => {
                const res = await authorisedUser.post('/graphql')
                    .field('operations', JSON.stringify({
                        query: print(UPLOAD_DATA_IN_ARRAY),
                        variables: {
                            studyId: createdStudy.id,
                            data: [
                                {
                                    fieldId: '33',
                                    subjectId: 'I7N3G6G',
                                    visitId: '1',
                                    file: null,
                                    metadata: {
                                        deviceId: 'MMM7N3G6G',
                                        startDate: '1590966000000',
                                        endDate: '1593730800000',
                                        participantId: 'I7N3G6G',
                                        postFix: 'txt'
                                    }
                                }
                            ]
                        }
                    }))
                    .field('map', JSON.stringify({ 1: ['variables.data.0.file'] }))
                    .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                // check both data collection and file collection
                const fileFirst = await db.collections.files_collection.findOne<IFile>({ 'studyId': createdStudy.id, 'life.deletedTime': null });
                const dataFirst = await db.collections.data_collection.findOne<IDataEntry>({ 'studyId': createdStudy.id, 'properties.m_visitId': '1', 'fieldId': '33' });
                expect(dataFirst?.value).toBe(fileFirst.id);
                expect(dataFirst?.life.deletedTime).toBe(null);
            });

            test('Create New data version with data only (user with study privilege)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                const createRes = await admin.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                expect(createRes.status).toBe(200);
                expect(createRes.body.errors).toBeUndefined();
                expect(createRes.body.data.createNewDataVersion.version).toBe('1');
                expect(createRes.body.data.createNewDataVersion.tag).toBe('testTag');
                const studyInDb = await db.collections.studies_collection.findOne({ id: createdStudy.id });
                expect(studyInDb.dataVersions).toHaveLength(2);
                expect(studyInDb.dataVersions[1].version).toBe('1');
                expect(studyInDb.dataVersions[1].tag).toBe('testTag');
                const dataInDb = await db.collections.data_collection.find({ studyId: createdStudy.id, dataVersion: createRes.body.data.createNewDataVersion.id }).toArray();
                expect(dataInDb).toHaveLength(6);
            });

            test('Create New data version with field only (user with study privilege)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_NEW_FIELD),
                    variables: {
                        studyId: createdStudy.id, fieldInput: {
                            fieldId: '34',
                            fieldName: 'Height',
                            dataType: 'dec',
                            unit: 'cm'
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                const createRes = await admin.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                expect(createRes.status).toBe(200);
                expect(createRes.body.errors).toBeUndefined();
                expect(createRes.body.data.createNewDataVersion.version).toBe('1');
                expect(createRes.body.data.createNewDataVersion.tag).toBe('testTag');
                const studyInDb = await db.collections.studies_collection.findOne({ id: createdStudy.id });
                expect(studyInDb.dataVersions).toHaveLength(2);
                expect(studyInDb.dataVersions[1].version).toBe('1');
                expect(studyInDb.dataVersions[1].tag).toBe('testTag');
                const fieldIndb = await db.collections.field_dictionary_collection.find({ studyId: createdStudy.id, dataVersion: { $in: [createRes.body.data.createNewDataVersion.id, 'mockDataVersionId'] } }).toArray();
                expect(fieldIndb).toHaveLength(4);
            });

            test('Create New data version with field and data (user with study privilege)', async () => {
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_FIELD),
                    variables: {
                        studyId: createdStudy.id, fieldInput: {
                            fieldId: '34',
                            fieldName: 'Height',
                            dataType: 'dec',
                            unit: 'cm'
                        }
                    }
                });
                await admin.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: {
                        studyId: createdStudy.id,
                        data: [{
                            fieldId: '34',
                            value: '163.4',
                            subjectId: 'I7N3G6G',
                            visitId: '1'
                        }, ...multipleRecords]
                    }
                });
                const createRes = await admin.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                expect(createRes.status).toBe(200);
                expect(createRes.body.errors).toBeUndefined();
                expect(createRes.body.data.createNewDataVersion.version).toBe('1');
                expect(createRes.body.data.createNewDataVersion.tag).toBe('testTag');
                const studyInDb = await db.collections.studies_collection.findOne({ id: createdStudy.id });
                expect(studyInDb.dataVersions).toHaveLength(2);
                expect(studyInDb.dataVersions[1].version).toBe('1');
                expect(studyInDb.dataVersions[1].tag).toBe('testTag');
                const dataInDb = await db.collections.data_collection.find({ studyId: createdStudy.id, dataVersion: createRes.body.data.createNewDataVersion.id }).toArray();
                expect(dataInDb).toHaveLength(7);
                const fieldsInDb = await db.collections.field_dictionary_collection.find({ studyId: createdStudy.id, dataVersion: { $in: [createRes.body.data.createNewDataVersion.id, 'mockDataVersionId'] } }).toArray();
                expect(fieldsInDb).toHaveLength(4);
            });

            test('Create New data version (authorised user) should fail', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();

                const createRes = await authorisedUser.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag', baseVersions: [], subjectIds: [], visitIds: [], withUnversionedData: true }
                });
                expect(createRes.status).toBe(200);
                expect(createRes.body.errors).toHaveLength(1);
                expect(createRes.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            });

            test('Delete data records: (unauthorised user) should fail', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();

                const deleteRes = await user.post('/graphql').send({
                    query: print(DELETE_DATA_RECORDS),
                    variables: { studyId: createdStudy.id, subjectId: 'I7N3G6G' }
                });
                expect(deleteRes.status).toBe(200);
                expect(deleteRes.body.errors).toHaveLength(1);
                expect(deleteRes.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            });

            test('Delete data records: subjectId (user with study privilege)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                const deleteRes = await authorisedUser.post('/graphql').send({
                    query: print(DELETE_DATA_RECORDS),
                    variables: { studyId: createdStudy.id, subjectIds: ['I7N3G6G'] }
                });
                expect(deleteRes.status).toBe(200);
                expect(deleteRes.body.errors).toBeUndefined();
                expect(deleteRes.body.data.deleteDataRecords).toEqual([
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-1:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-1:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-1:fieldId-33 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-33 is deleted.' }]);
            });

            test('Delete data records: visitId (admin)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();

                const deleteRes = await authorisedUser.post('/graphql').send({
                    query: print(DELETE_DATA_RECORDS),
                    variables: { studyId: createdStudy.id, visitIds: ['2'] }
                });
                expect(deleteRes.status).toBe(200);
                expect(deleteRes.body.errors).toBeUndefined();
                expect(deleteRes.body.data.deleteDataRecords).toEqual([
                    { successful: true, id: null, code: null, description: 'SubjectId-GR6R4AR:visitId-2:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-GR6R4AR:visitId-2:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-GR6R4AR:visitId-2:fieldId-33 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-33 is deleted.' }
                ]);
            });

            test('Delete data records: studyId (admin)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.uploadDataInArray).toEqual([
                    { code: null, description: 'I7N3G6G-1-31', id: null, successful: true },
                    { code: null, description: 'I7N3G6G-1-32', id: null, successful: true },
                    { code: null, description: 'I7N3G6G-2-31', id: null, successful: true },
                    { code: null, description: 'I7N3G6G-2-32', id: null, successful: true },
                    { code: null, description: 'GR6R4AR-2-31', id: null, successful: true },
                    { code: null, description: 'GR6R4AR-2-32', id: null, successful: true }
                ]);
                const deleteRes = await admin.post('/graphql').send({
                    query: print(DELETE_DATA_RECORDS),
                    variables: { studyId: createdStudy.id }
                });
                expect(deleteRes.status).toBe(200);
                expect(deleteRes.body.errors).toBeUndefined();
                expect(deleteRes.body.data.deleteDataRecords).toEqual([
                    { successful: true, id: null, code: null, description: 'SubjectId-GR6R4AR:visitId-1:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-GR6R4AR:visitId-1:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-GR6R4AR:visitId-1:fieldId-33 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-GR6R4AR:visitId-2:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-GR6R4AR:visitId-2:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-GR6R4AR:visitId-2:fieldId-33 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-1:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-1:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-1:fieldId-33 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-33 is deleted.' }]);
                const dataInDb = await db.collections.data_collection.find({}).sort({ 'life.createdTime': -1 }).toArray();
                expect(dataInDb).toHaveLength(18); // 2 visits * 2 subjects * 3 fields + 6 (original records) = 18 records
            });

            test('Delete data records: records not exist', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.uploadDataInArray).toEqual([
                    { code: null, description: 'I7N3G6G-1-31', id: null, successful: true },
                    { code: null, description: 'I7N3G6G-1-32', id: null, successful: true },
                    { code: null, description: 'I7N3G6G-2-31', id: null, successful: true },
                    { code: null, description: 'I7N3G6G-2-32', id: null, successful: true },
                    { code: null, description: 'GR6R4AR-2-31', id: null, successful: true },
                    { code: null, description: 'GR6R4AR-2-32', id: null, successful: true }
                ]);
                const deleteRes = await admin.post('/graphql').send({
                    query: print(DELETE_DATA_RECORDS),
                    variables: { studyId: createdStudy.id, subjectIds: ['I7N3G6G'], visitIds: ['1', '2'] }
                });
                expect(deleteRes.status).toBe(200);
                expect(deleteRes.body.errors).toBeUndefined();
                expect(deleteRes.body.data.deleteDataRecords).toEqual([
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-1:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-1:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-1:fieldId-33 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-31 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-32 is deleted.' },
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-33 is deleted.' }]);
                const dataInDb = await db.collections.data_collection.find({}).sort({ 'life.createdTime': -1 }).toArray();
                expect(dataInDb).toHaveLength(12); // 1 subject * 3 fields * 2visits +  6 original records
            });

            test('Get data records (user with study privilege)', async () => {
                await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: {
                        studyId: createdStudy.id, data: [
                            {
                                fieldId: '31',
                                value: '10',
                                subjectId: 'I7N3G6G',
                                visitId: '3'
                            }
                        ]
                    }
                });
                const getRes = await admin.post('/graphql').send({
                    query: print(GET_DATA_RECORDS),
                    variables: {
                        studyId: createdStudy.id,
                        queryString: {
                            data_requested: ['31', '32'],
                            format: 'raw',
                            cohort: [[]],
                            new_fields: []
                        }
                    }
                });
                expect(getRes.status).toBe(200);
                expect(getRes.body.errors).toBeUndefined();
                expect(Object.keys(getRes.body.data.getDataRecords.data)).toHaveLength(2);
            });

            test('Create an ontology tree (authorised user)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(CREATE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        ontologyTree: {
                            name: 'fakeTree',
                            routes: [
                                {
                                    path: ['DM', 'm_subjectId', 'm_visitId'],
                                    name: 'AGE',
                                    field: ['$100'],
                                    visitRange: []
                                },
                                {
                                    path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                                    name: 'Q1',
                                    field: ['$200'],
                                    visitRange: []
                                }
                            ]
                        }
                    }
                });
                const study = await db.collections.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.createOntologyTree).toEqual({
                    id: study.ontologyTrees[1].id,
                    name: 'fakeTree',
                    routes: [
                        {
                            id: study.ontologyTrees[1].routes[0].id,
                            path: ['DM', 'm_subjectId', 'm_visitId'],
                            name: 'AGE',
                            field: ['$100'],
                            visitRange: []
                        },
                        {
                            id: study.ontologyTrees[1].routes[1].id,
                            path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                            name: 'Q1',
                            field: ['$200'],
                            visitRange: []
                        }
                    ],
                    metadata: null
                });
                // clear ontologyTrees
                await db.collections.studies_collection.findOneAndUpdate({ id: createdStudy.id, deleted: null }, {
                    $set: {
                        ontologyTrees: []
                    }
                });
            });

            test('Create an ontology tree (unauthorised user), should fail', async () => {
                const res = await user.post('/graphql').send({
                    query: print(CREATE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        ontologyTree: {
                            name: 'fakeTree',
                            routes: [
                                {
                                    path: ['DM', 'm_subjectId', 'm_visitId'],
                                    name: 'AGE',
                                    field: ['$100'],
                                    visitRange: []
                                },
                                {
                                    path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                                    name: '',
                                    field: ['$200'],
                                    visitRange: []
                                }
                            ]
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.createOntologyTree).toBe(null);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            });

            test('Delete an ontology tree (authorised user)', async () => {
                await authorisedUser.post('/graphql').send({
                    query: print(CREATE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        ontologyTree: {
                            name: 'fakeTree',
                            routes: [
                                {
                                    path: ['DM', 'm_subjectId', 'm_visitId'],
                                    name: 'AGE',
                                    field: ['$100'],
                                    visitRange: []
                                },
                                {
                                    path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                                    name: '',
                                    field: ['$200'],
                                    visitRange: []
                                }
                            ]
                        }
                    }
                });
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                const study: IStudy = await db.collections.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                const res = await authorisedUser.post('/graphql').send({
                    query: print(DELETE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        treeName: study.ontologyTrees[0].name
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.deleteOntologyTree).toEqual({
                    id: study.ontologyTrees[0].name,
                    successful: true
                });
                const updatedStudy: IStudy = await db.collections.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                expect(updatedStudy.ontologyTrees.length).toBe(2); // both records
                // clear study
                await db.collections.studies_collection.findOneAndUpdate({ id: createdStudy.id, deleted: null }, {
                    $set: {
                        dataVersions: [],
                        currentDataVersion: -1,
                        ontologyTrees: []
                    }
                });
            });

            test('Delete an ontology tree (unauthorised user), should fail', async () => {
                await authorisedUser.post('/graphql').send({
                    query: print(CREATE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        ontologyTree: {
                            name: 'fakeTree',
                            routes: [
                                {
                                    path: ['DM', 'm_subjectId', 'm_visitId'],
                                    name: 'AGE',
                                    field: ['$100'],
                                    visitRange: []
                                },
                                {
                                    path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                                    name: '',
                                    field: ['$200'],
                                    visitRange: []
                                }
                            ]
                        }
                    }
                });
                const study: IStudy = await db.collections.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                const res = await user.post('/graphql').send({
                    query: print(DELETE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        treeName: study.ontologyTrees[0].name
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.deleteOntologyTree).toBe(null);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                await db.collections.studies_collection.findOneAndUpdate({ studyId: createdStudy.id, deleted: null }, {
                    $set: {
                        ontologyTrees: []
                    }
                });
            });

            test('Get an ontology tree with versioning (authorised user)', async () => {
                await authorisedUser.post('/graphql').send({
                    query: print(CREATE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        ontologyTree: {
                            name: 'fakeTree',
                            routes: [
                                {
                                    path: ['DM', 'm_subjectId', 'm_visitId'],
                                    name: 'AGE',
                                    field: ['$100'],
                                    visitRange: []
                                },
                                {
                                    path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                                    name: '',
                                    field: ['$200'],
                                    visitRange: []
                                }
                            ]
                        }
                    }
                });
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                await authorisedUser.post('/graphql').send({
                    query: print(CREATE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        ontologyTree: {
                            name: 'fakeTree',
                            routes: [
                                {
                                    path: ['DM', 'm_subjectId', 'm_visitId'],
                                    name: 'AGEnew',
                                    field: ['$100'],
                                    visitRange: []
                                },
                                {
                                    path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                                    name: '',
                                    field: ['$200'],
                                    visitRange: []
                                }
                            ]
                        }
                    }
                });
                const study: IStudy = await db.collections.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                const resWithoutVersion = await authorisedUser.post('/graphql').send({
                    query: print(GET_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        treeName: null
                    }
                });
                expect(resWithoutVersion.status).toBe(200);
                expect(resWithoutVersion.body.data.getOntologyTree).toHaveLength(1);
                expect(resWithoutVersion.body.data.getOntologyTree[0]).toEqual({
                    id: study.ontologyTrees[0].id,
                    name: 'fakeTree',
                    routes: [
                        {
                            id: study.ontologyTrees[0].routes[0].id,
                            path: ['DM', 'm_subjectId', 'm_visitId'],
                            name: 'AGE',
                            field: ['$100'],
                            visitRange: []
                        },
                        {
                            id: study.ontologyTrees[0].routes[1].id,
                            path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                            name: '',
                            field: ['$200'],
                            visitRange: []
                        }
                    ],
                    metadata: null
                });
                const resWithVersion = await authorisedUser.post('/graphql').send({
                    query: print(GET_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        treeName: null,
                        versionId: null
                    }
                });
                expect(resWithVersion.status).toBe(200);
                expect(resWithVersion.body.data.getOntologyTree).toHaveLength(1);
                expect(resWithVersion.body.data.getOntologyTree[0]).toEqual({
                    id: study.ontologyTrees[1].id,
                    name: 'fakeTree',
                    routes: [
                        {
                            id: study.ontologyTrees[1].routes[0].id,
                            path: ['DM', 'm_subjectId', 'm_visitId'],
                            name: 'AGEnew',
                            field: ['$100'],
                            visitRange: []
                        },
                        {
                            id: study.ontologyTrees[1].routes[1].id,
                            path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                            name: '',
                            field: ['$200'],
                            visitRange: []
                        }
                    ],
                    metadata: null
                });
                // clear study
                await db.collections.studies_collection.findOneAndUpdate({ id: createdStudy.id, deleted: null }, {
                    $set: {
                        dataVersions: [],
                        currentDataVersion: -1,
                        ontologyTrees: []
                    }
                });
            });

            test('Get an ontology tree from project (authorised user)', async () => {
                await authorisedUser.post('/graphql').send({
                    query: print(CREATE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        ontologyTree: {
                            name: 'fakeTree',
                            routes: [
                                {
                                    path: ['DM', 'm_subjectId', 'm_visitId'],
                                    name: 'AGE',
                                    field: ['$100'],
                                    visitRange: []
                                },
                                {
                                    path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                                    name: '',
                                    field: ['$200'],
                                    visitRange: []
                                }
                            ]
                        }
                    }
                });
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                const res = await user.post('/graphql').send({
                    query: print(GET_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdProject.studyId,
                        projectId: createdProject.id,
                        treeName: null
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.getOntologyTree).toBe(null);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                // clear study
                await db.collections.studies_collection.findOneAndUpdate({ id: createdStudy.id, deleted: null }, {
                    $set: {
                        dataVersions: [],
                        currentDataVersion: -1,
                        ontologyTrees: []
                    }
                });
            });

            test('Get an ontology tree (unauthorised user), should fail', async () => {
                await authorisedUser.post('/graphql').send({
                    query: print(CREATE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        ontologyTree: {
                            name: 'fakeTree',
                            routes: [
                                {
                                    path: ['DM', 'm_subjectId', 'm_visitId'],
                                    name: 'AGE',
                                    field: ['$100'],
                                    visitRange: []
                                },
                                {
                                    path: ['QS', 'MFI', 'm_subjectId', 'm_visitId'],
                                    name: '',
                                    field: ['$200'],
                                    visitRange: []
                                }
                            ]
                        }
                    }
                });
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                const res = await user.post('/graphql').send({
                    query: print(GET_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdProject.studyId,
                        projectId: createdProject.id,
                        treeName: null
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.getOntologyTree).toBe(null);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                // clear study
                await db.collections.studies_collection.findOneAndUpdate({ id: createdStudy.id, deleted: null }, {
                    $set: {
                        dataVersions: [],
                        currentDataVersion: -1,
                        ontologyTrees: []
                    }
                });
            });
        });
    });
} else
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });

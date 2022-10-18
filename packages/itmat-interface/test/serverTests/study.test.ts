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
import { errorCodes } from '../../src/graphql/errors';
import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
import {
    GET_STUDY_FIELDS,
    EDIT_PROJECT_APPROVED_FIELDS,
    GET_PROJECT_PATIENT_MAPPING,
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
    EDIT_PROJECT_APPROVED_FILES,
    SET_DATAVERSION_AS_CURRENT,
    EDIT_STUDY,
    UPLOAD_DATA_IN_ARRAY,
    DELETE_DATA_RECORDS,
    GET_DATA_RECORDS,
    CREATE_NEW_DATA_VERSION,
    CHECK_DATA_COMPLETE,
    CREATE_NEW_FIELD,
    DELETE_FIELD,
    CREATE_ONTOLOGY_TREE,
    DELETE_ONTOLOGY_TREE,
    GET_ONTOLOGY_TREE
} from '@itmat-broker/itmat-models';
import {
    permissions,
    userTypes,
    studyType,
    enumValueType,
    IDataEntry,
    IUser,
    IFile,
    IFieldEntry,
    IStudyDataVersion,
    IStudy,
    IProject,
    IRole
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
        await db.connect(config.database, MongoClient.connect as any);
        await objStore.connect(config.objectStore);
        const router = new Router(config);

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
                    type: userTypes.ADMIN,
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
                            name: studyName,
                            type: studyType.SENSOR
                        }]
                    },
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000
                });

                /* cleanup: delete study */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
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
                    description: 'edited description',
                    type: studyType.SENSOR
                });

                /* cleanup: delete study */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
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
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
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
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
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
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
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
                    dataVersions: [],
                    type: studyType.SENSOR
                };
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(newStudy);

                const resWhoAmI = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
                expect(resWhoAmI.status).toBe(200);
                expect(resWhoAmI.body.data.errors).toBeUndefined();
                expect(resWhoAmI.body.data.whoAmI).toEqual({
                    username: 'admin',
                    type: userTypes.ADMIN,
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
                            name: studyName,
                            type: studyType.SENSOR
                        }]
                    },
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000
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
                expect(typeof study.deleted).toBe('number');

                const resWhoAmIAfter = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
                expect(resWhoAmIAfter.status).toBe(200);
                expect(resWhoAmIAfter.body.data.errors).toBeUndefined();
                expect(resWhoAmIAfter.body.data.whoAmI).toEqual({
                    username: 'admin',
                    type: userTypes.ADMIN,
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
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000
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
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(newStudy);

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
                expect(createdStudy.deleted).toBe(null);

                /* cleanup: delete study */
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).findOneAndUpdate({ name: studyName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
            });
        });

        describe('MANIPULATING PROJECTS EXISTENCE', () => {
            let testCounter = 0;
            let setupStudy: { id: any; name?: string; createdBy?: string; lastModified?: number; deleted?: null; currentDataVersion?: number; dataVersions?: { id: string; contentId: string; version: string; tag: string; updateDate: string; }[]; };
            let setupProject: { id: any; studyId?: string; createdBy?: string; name?: string; patientMapping?: { patient001: string; }; approvedFields?: never[]; approvedFiles?: never[]; lastModified?: number; deleted?: null; };
            beforeEach(async () => {
                testCounter++;
                /* setup: creating a study */
                const studyName = uuid() + 'STUDYNAME_manipulating_project_existentce_' + testCounter;
                setupStudy = {
                    id: `id_${studyName}`,
                    name: studyName,
                    createdBy: 'admin',
                    lastModified: 200000002,
                    deleted: null,
                    currentDataVersion: 0,
                    dataVersions: [
                        {
                            id: 'dataVersionId',
                            contentId: 'dataVersionContentId',
                            version: '1',
                            tag: '1',
                            updateDate: '1628049066475'
                        }
                    ]
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
                    approvedFields: [],
                    approvedFiles: [],
                    lastModified: 20000002,
                    deleted: null
                };
                await mongoClient.collection<IProject>(config.database.collections.projects_collection).insertOne(setupProject);
            });

            afterEach(async () => {
                await mongoClient.collection<IStudy>(config.database.collections.studies_collection).updateOne({ id: setupStudy.id }, { $set: { deleted: 10000 } });
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
                    approvedFields: [],
                    approvedFiles: [],
                    lastModified: createdProject.lastModified,
                    deleted: null
                });
                expect(res.body.data.createProject).toEqual({
                    id: createdProject.id,
                    studyId: setupStudy.id,
                    name: projectName,
                    approvedFields: []
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
                    type: userTypes.STANDARD,
                    firstname: `${username}_firstname`,
                    lastname: `${username}_lastname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@example.com`,
                    resetPasswordRequests: [],
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'organisation_system',
                    deleted: null,
                    id: `new_user_id_${username}`,
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000
                };
                await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(authorisedUserProfile);

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
                    approvedFields: [],
                    approvedFiles: [],
                    lastModified: createdProject.lastModified,
                    deleted: null
                });
                expect(res.body.data.createProject).toEqual({
                    id: createdProject.id,
                    studyId: setupStudy.id,
                    name: projectName,
                    approvedFields: []
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
                    type: userTypes.STANDARD,
                    firstname: `${username}_firstname`,
                    lastname: `${username}_lastname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@example.com`,
                    resetPasswordRequests: [],
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'organisation_system',
                    deleted: null,
                    id: `new_user_id_${username}`,
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000
                };
                await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(authorisedUserProfile);

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
            let createdRole_study_self_access: { _id: any; id: any; name: any; };
            let createdRole_project: { _id: any; id: any; name: any; };
            let createdUserAuthorised: { id: any; firstname: any; lastname: any; username: string; otpSecret: string; };  // profile
            let createdUserAuthorisedStudy: { id: any; firstname: any; lastname: any; username: string; otpSecret: string; };  // profile
            let createdUserAuthorisedStudyManageProjects: { id: any; firstname: any; lastname: any; username: string; otpSecret: string; };  // profile
            let createdUserAuthorisedToOneOrg: { id: any; firstname: any; lastname: any; username: string; otpSecret: string; }; // profile
            let authorisedUser: request.SuperTest<request.Test>; // client
            let authorisedUserStudy: request.SuperTest<request.Test>; // client
            let authorisedUserStudyManageProject: request.SuperTest<request.Test>; // client
            let authorisedUserToOneOrg: request.SuperTest<request.Test>; // client
            let mockFields: IFieldEntry[];
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
                    const mockData: IDataEntry[] = [
                        {
                            id: 'mockData1',
                            m_subjectId: 'mock_patient1',
                            m_visitId: 'mockvisitId',
                            m_studyId: createdStudy.id,
                            m_versionId: mockDataVersion.id,
                            31: 'male',
                            49: 'England',
                            deleted: null
                        },
                        {
                            id: 'mockData2',
                            m_subjectId: 'mock_patient2',
                            m_visitId: 'mockvisitId',
                            m_studyId: createdStudy.id,
                            m_versionId: mockDataVersion.id,
                            31: 'female',
                            49: 'France',
                            deleted: null
                        }
                    ];
                    mockFields = [
                        {
                            id: 'mockfield1',
                            studyId: createdStudy.id,
                            fieldId: '31',
                            fieldName: 'Sex',
                            dataType: enumValueType.STRING,
                            possibleValues: [],
                            unit: 'person',
                            comments: 'mockComments1',
                            dateAdded: '2021-05-16T16:32:10.226Z',
                            dateDeleted: null,
                            dataVersion: 'mockDataVersionId'
                        },
                        {
                            id: 'mockfield2',
                            studyId: createdStudy.id,
                            fieldId: '32',
                            fieldName: 'Sex',
                            dataType: enumValueType.STRING,
                            possibleValues: [],
                            unit: 'person',
                            comments: 'mockComments2',
                            dateAdded: '2022-06-18T17:35:15.226Z',
                            dateDeleted: null,
                            dataVersion: 'mockDataVersionId'
                        }
                    ];

                    mockFiles = [
                        {
                            id: 'mockfile1_id',
                            fileName: 'I7N3G6G-MMM7N3G6G-20200704-20210429.txt',
                            studyId: createdStudy.id,
                            fileSize: '1000',
                            description: 'Just a test file1',
                            uploadTime: '1599345644000',
                            uploadedBy: adminId,
                            uri: 'fakeuri',
                            deleted: null,
                            hash: 'b0dc2ae76cdea04dcf4be7fcfbe36e2ce8d864fe70a1895c993ce695274ba7a0'
                        },
                        {
                            id: 'mockfile2_id',
                            fileName: 'GR6R4AR-MMMS3JSPP-20200601-20200703.json',
                            studyId: createdStudy.id,
                            fileSize: '1000',
                            description: 'Just a test file2',
                            uploadTime: '1599345644000',
                            uploadedBy: adminId,
                            uri: 'fakeuri2',
                            deleted: null,
                            hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a3'
                        }
                    ];
                    await db.collections!.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: mockDataVersion }, $inc: { currentDataVersion: 1 } });
                    await db.collections!.data_collection.insertMany(mockData);
                    await db.collections!.field_dictionary_collection.insertMany(mockFields);
                    await db.collections!.files_collection.insertMany(mockFiles);
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
                        name: projectName,
                        approvedFields: []
                    });
                }

                /* 3. create roles for study */
                {
                    const roleName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(ADD_NEW_ROLE),
                        variables: {
                            roleName,
                            studyId: createdStudy.id,
                            projectId: null
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();

                    createdRole_study = await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ name: roleName });
                    expect(createdRole_study).toEqual({
                        _id: createdRole_study._id,
                        id: createdRole_study.id,
                        projectId: null,
                        studyId: createdStudy.id,
                        name: roleName,
                        permissions: [],
                        createdBy: adminId,
                        users: [],
                        deleted: null
                    });
                    expect(res.body.data.addRoleToStudyOrProject).toEqual({
                        id: createdRole_study.id,
                        name: roleName,
                        permissions: [],
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
                            studyId: createdStudy.id,
                            projectId: null
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();

                    createdRole_study_manageProject = await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ name: roleName });
                    expect(createdRole_study_manageProject).toEqual({
                        _id: createdRole_study_manageProject._id,
                        id: createdRole_study_manageProject.id,
                        projectId: null,
                        studyId: createdStudy.id,
                        name: roleName,
                        permissions: [],
                        createdBy: adminId,
                        users: [],
                        deleted: null
                    });
                    expect(res.body.data.addRoleToStudyOrProject).toEqual({
                        id: createdRole_study_manageProject.id,
                        name: roleName,
                        permissions: [],
                        studyId: createdStudy.id,
                        projectId: null,
                        users: []
                    });
                }

                /* create another role for access data with self organisation only */
                {
                    const roleName = uuid();
                    const res = await admin.post('/graphql').send({
                        query: print(ADD_NEW_ROLE),
                        variables: {
                            roleName,
                            studyId: createdStudy.id,
                            projectId: null
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();

                    createdRole_study_self_access = await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ name: roleName });
                    expect(createdRole_study_self_access).toEqual({
                        _id: createdRole_study_self_access._id,
                        id: createdRole_study_self_access.id,
                        projectId: null,
                        studyId: createdStudy.id,
                        name: roleName,
                        permissions: [],
                        createdBy: adminId,
                        users: [],
                        deleted: null
                    });
                    expect(res.body.data.addRoleToStudyOrProject).toEqual({
                        id: createdRole_study_self_access.id,
                        name: roleName,
                        permissions: [],
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
                        permissions: [],
                        createdBy: adminId,
                        users: [],
                        deleted: null
                    });
                    expect(res.body.data.addRoleToStudyOrProject).toEqual({
                        id: createdRole_project.id,
                        name: roleName,
                        permissions: [],
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
                        type: userTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}@user.io`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised project user.',
                        emailNotificationsActivated: true,
                        organisation: 'organisation_system',
                        deleted: null,
                        id: `AuthorisedProjectUser_${username}`,
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
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
                                add: [permissions.specific_project.specific_project_readonly_access],
                                remove: []
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
                        permissions: [permissions.specific_project.specific_project_readonly_access],
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
                        type: userTypes.STANDARD,
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
                }

                /* 5. create an authorised study user (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: userTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}@user.io`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised study user.',
                        emailNotificationsActivated: true,
                        organisation: 'organisation_system',
                        deleted: null,
                        id: `AuthorisedStudyUser_${username}`,
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
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
                                add: [permissions.specific_study.specific_study_readonly_access],
                                remove: []
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
                        permissions: [permissions.specific_study.specific_study_readonly_access],
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
                        type: userTypes.STANDARD,
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
                }

                /* 5. create an authorised study user that can manage projects (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: userTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}'@user.io'`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised study user managing project.',
                        emailNotificationsActivated: true,
                        organisation: 'organisation_system',
                        deleted: null,
                        id: `AuthorisedStudyUserManageProject_${username}`,
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
                    };

                    await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
                    createdUserAuthorisedStudyManageProjects = await mongoClient.collection<IUser>(config.database.collections.users_collection).findOne({ username });
                }

                /* 5. create an authorised study user that can access data from self organisation only */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: userTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}'@user.io'`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised study user to access self org data.',
                        emailNotificationsActivated: true,
                        organisation: 'organisation_user',
                        deleted: null,
                        id: `AuthorisedStudyUserManageProject_${username}`,
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
                    };

                    await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
                    createdUserAuthorisedToOneOrg = await mongoClient.collection<IUser>(config.database.collections.users_collection).findOne({ username });
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
                                add: [permissions.specific_study.specific_study_projects_management],
                                remove: []
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
                        permissions: [permissions.specific_study.specific_study_projects_management],
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
                        type: userTypes.STANDARD,
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
                /* 7. add authorised user to role */
                {
                    const res = await admin.post('/graphql').send({
                        query: print(EDIT_ROLE),
                        variables: {
                            roleId: createdRole_study_self_access.id,
                            userChanges: {
                                add: [createdUserAuthorisedToOneOrg.id],
                                remove: []
                            },
                            permissionChanges: {
                                add: [permissions.specific_study.specific_study_readonly_access, permissions.specific_study.specific_study_data_own_organisation_only, permissions.specific_study.specific_study_projects_management],
                                remove: []
                            }
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.editRole).toEqual({
                        id: createdRole_study_self_access.id,
                        name: createdRole_study_self_access.name,
                        studyId: createdStudy.id,
                        projectId: null,
                        permissions: [permissions.specific_study.specific_study_readonly_access, permissions.specific_study.specific_study_data_own_organisation_only, permissions.specific_study.specific_study_projects_management],
                        users: [{
                            id: createdUserAuthorisedToOneOrg.id,
                            organisation: 'organisation_user',
                            firstname: createdUserAuthorisedToOneOrg.firstname,
                            lastname: createdUserAuthorisedToOneOrg.lastname
                        }]
                    });
                    const resUser = await admin.post('/graphql').send({
                        query: print(GET_USERS),
                        variables: {
                            fetchDetailsAdminOnly: false,
                            userId: createdUserAuthorisedToOneOrg.id,
                            fetchAccessPrivileges: true
                        }
                    });
                    expect(resUser.status).toBe(200);
                    expect(resUser.body.errors).toBeUndefined();
                    expect(resUser.body.data.getUsers).toHaveLength(1);
                    expect(resUser.body.data.getUsers[0]).toEqual({
                        id: createdUserAuthorisedToOneOrg.id,
                        type: userTypes.STANDARD,
                        firstname: `${createdUserAuthorisedToOneOrg.username}_firstname`,
                        lastname: `${createdUserAuthorisedToOneOrg.username}_lastname`,
                        organisation: 'organisation_user',
                        access: {
                            id: `user_access_obj_user_id_${createdUserAuthorisedToOneOrg.id}`,
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
                        type: userTypes.ADMIN,
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
                                name: createdStudy.name,
                                type: studyType.SENSOR
                            }]
                        },
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
                    });
                }
                /* connecting users */
                authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, createdUserAuthorised.username, 'admin', createdUserAuthorised.otpSecret);
                authorisedUserStudy = request.agent(app);
                await connectAgent(authorisedUserStudy, createdUserAuthorisedStudy.username, 'admin', createdUserAuthorisedStudy.otpSecret);
                authorisedUserStudyManageProject = request.agent(app);
                await connectAgent(authorisedUserStudyManageProject, createdUserAuthorisedStudyManageProjects.username, 'admin', createdUserAuthorisedStudyManageProjects.otpSecret);
                authorisedUserToOneOrg = request.agent(app);
                await connectAgent(authorisedUserToOneOrg, createdUserAuthorisedToOneOrg.username, 'admin', createdUserAuthorisedToOneOrg.otpSecret);
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
                await db.collections!.field_dictionary_collection.deleteMany({ studyId: createdStudy.id });
                await db.collections!.data_collection.deleteMany({ m_studyId: createdStudy.id });
                await db.collections!.files_collection.deleteMany({ studyId: createdStudy.id });

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
                        type: userTypes.ADMIN,
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
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
                    });

                    // study data is NOT deleted for audit purposes - unless explicitly requested separately
                    const roles = await db.collections!.roles_collection.find({ studyId: createdStudy.id, deleted: null }).toArray();
                    const projects = await db.collections!.projects_collection.find({ studyId: createdStudy.id, deleted: null }).toArray();
                    const study = await db.collections!.studies_collection.findOne({ id: createdStudy.id, deleted: null });
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
                        type: studyType.SENSOR,
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
                                permissions: [permissions.specific_study.specific_study_readonly_access],
                                projectId: null,
                                studyId: createdStudy.id,
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
                                permissions: [permissions.specific_study.specific_study_projects_management],
                                projectId: null,
                                studyId: createdStudy.id,
                                users: [{
                                    id: createdUserAuthorisedStudyManageProjects.id,
                                    organisation: 'organisation_system',
                                    firstname: createdUserAuthorisedStudyManageProjects.firstname,
                                    lastname: createdUserAuthorisedStudyManageProjects.lastname,
                                    username: createdUserAuthorisedStudyManageProjects.username
                                }]
                            },
                            {
                                id: createdRole_study_self_access.id,
                                name: createdRole_study_self_access.name,
                                permissions: [permissions.specific_study.specific_study_readonly_access, permissions.specific_study.specific_study_data_own_organisation_only, permissions.specific_study.specific_study_projects_management],
                                projectId: null,
                                studyId: createdStudy.id,
                                users: [{
                                    id: createdUserAuthorisedToOneOrg.id,
                                    organisation: 'organisation_user',
                                    firstname: createdUserAuthorisedToOneOrg.firstname,
                                    lastname: createdUserAuthorisedToOneOrg.lastname,
                                    username: createdUserAuthorisedToOneOrg.username
                                }]
                            }
                        ],
                        files: [
                            {
                                id: 'mockfile1_id',
                                fileName: 'I7N3G6G-MMM7N3G6G-20200704-20210429.txt',
                                studyId: createdStudy.id,
                                projectId: null,
                                fileSize: '1000',
                                description: 'Just a test file1',
                                uploadTime: '1599345644000',
                                uploadedBy: adminId,
                                hash: 'b0dc2ae76cdea04dcf4be7fcfbe36e2ce8d864fe70a1895c993ce695274ba7a0'
                            },
                            {
                                id: 'mockfile2_id',
                                fileName: 'GR6R4AR-MMMS3JSPP-20200601-20200703.json',
                                studyId: createdStudy.id,
                                projectId: null,
                                fileSize: '1000',
                                description: 'Just a test file2',
                                uploadTime: '1599345644000',
                                uploadedBy: adminId,
                                hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a3'
                            }
                        ],
                        ontologyTrees: [],
                        numOfRecords: 2,
                        subjects: ['mock_patient1', 'mock_patient2'],
                        visits: ['mockvisitId'],
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
                        approvedFields: [],
                        approvedFiles: [],
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
                            ]
                        },
                        jobs: [],
                        roles: [
                            {
                                id: createdRole_project.id,
                                name: createdRole_project.name,
                                permissions: [permissions.specific_project.specific_project_readonly_access],
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

            test('Get study (user that can only access self org data)', async () => {
                const res = await authorisedUserToOneOrg.post('/graphql').send({
                    query: print(GET_STUDY),
                    variables: { studyId: createdStudy.id }
                });
                expect(res.status).toBe(200);
                // expect(res.body.errors).toBeUndefined();
                expect(res.body.data.getStudy.files[0]).toEqual({
                    id: 'mockfile1_id',
                    fileName: 'I7N3G6G-MMM7N3G6G-20200704-20210429.txt',
                    studyId: createdStudy.id,
                    projectId: null,
                    fileSize: '1000',
                    description: 'Just a test file1',
                    uploadTime: '1599345644000',
                    uploadedBy: adminId,
                    hash: 'b0dc2ae76cdea04dcf4be7fcfbe36e2ce8d864fe70a1895c993ce695274ba7a0'
                }
                );
            });

            test('Get patient mapping (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(GET_PROJECT_PATIENT_MAPPING),
                    variables: { projectId: createdProject.id }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.getProject).toEqual({
                    id: createdProject.id,
                    patientMapping: {
                        mock_patient1: createdProject.patientMapping.mock_patient1,
                        mock_patient2: createdProject.patientMapping.mock_patient2
                    }
                });
                const { patientMapping } = res.body.data.getProject;
                expect(typeof patientMapping.mock_patient1).toBe('string');
                expect(patientMapping.mock_patient1).not.toBe('mock_patient1'); // should not be the same as before mapped
                expect(typeof patientMapping.mock_patient2).toBe('string');
                expect(patientMapping.mock_patient2).not.toBe('mock_patient2'); // should not be the same as before mapped
            });

            test('Get patient mapping (user without privilege) (should fail)', async () => {
                const res = await user.post('/graphql').send({
                    query: print(GET_PROJECT_PATIENT_MAPPING),
                    variables: { projectId: createdProject.id }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.getProject).toBe(null);
            });

            test('Get patient mapping (user with project data privilege) (should fail)', async () => {
                // patient mapping is obscured from users that can only access project data. They should only see the mapped id
                const res = await authorisedUser.post('/graphql').send({
                    query: print(GET_PROJECT_PATIENT_MAPPING),
                    variables: { projectId: createdProject.id }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.getProject).toBe(null);
            });

            test('Get patient mapping (user with study data privilege)', async () => {
                const res = await authorisedUserStudy.post('/graphql').send({
                    query: print(GET_PROJECT_PATIENT_MAPPING),
                    variables: { projectId: createdProject.id }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.getProject).toEqual({
                    id: createdProject.id,
                    patientMapping: {
                        mock_patient1: createdProject.patientMapping.mock_patient1,
                        mock_patient2: createdProject.patientMapping.mock_patient2
                    }
                });
                const { patientMapping } = res.body.data.getProject;
                expect(typeof patientMapping.mock_patient1).toBe('string');
                expect(patientMapping.mock_patient1).not.toBe('mock_patient1'); // should not be the same as before mapped
                expect(typeof patientMapping.mock_patient2).toBe('string');
                expect(patientMapping.mock_patient2).not.toBe('mock_patient2'); // should not be the same as before mapped
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
                            ]
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
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: enumValueType.STRING,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dateAdded: '2022-06-18T17:35:15.226Z',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    },
                    {
                        id: 'mockfield1',
                        studyId: createdStudy.id,
                        fieldId: '31',
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: enumValueType.STRING,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dateAdded: '2021-05-16T16:32:10.226Z',
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
                        dataType: enumValueType.STRING,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dateAdded: '2021-05-16T16:32:10.226Z',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    },
                    {
                        id: 'mockfield2',
                        studyId: createdStudy.id,
                        fieldId: '32',
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: enumValueType.STRING,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dateAdded: '2022-06-18T17:35:15.226Z',
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
                await db.collections!.field_dictionary_collection.insertOne({
                    id: 'mockfield2_deleted',
                    studyId: createdStudy.id,
                    fieldId: '32',
                    fieldName: 'Sex',
                    tableName: null,
                    dataType: enumValueType.STRING,
                    possibleValues: [],
                    unit: 'person',
                    comments: 'mockComments1',
                    dateAdded: '2021-05-18T16:32:10.226Z',
                    dateDeleted: '2021-05-18T16:32:10.226Z',
                    dataVersion: null
                });

                await db.collections!.field_dictionary_collection.insertOne({
                    id: 'mockfield3',
                    studyId: createdStudy.id,
                    fieldId: '33',
                    fieldName: 'Weight',
                    tableName: null,
                    dataType: enumValueType.DECIMAL,
                    possibleValues: [],
                    unit: 'kg',
                    comments: 'mockComments3',
                    dateAdded: '2021-05-18T16:32:10.226Z',
                    dateDeleted: null,
                    dataVersion: null
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
                expect(res.body.data.getStudyFields.sort((a: { id: string; }, b: { id: any; }) => a.id.localeCompare(b.id))).toEqual([ // as the api will sort the results, the order is changed
                    {
                        id: 'mockfield3',
                        studyId: createdStudy.id,
                        fieldId: '33',
                        fieldName: 'Weight',
                        tableName: null,
                        dataType: enumValueType.DECIMAL,
                        possibleValues: [],
                        unit: 'kg',
                        comments: 'mockComments3',
                        dateAdded: '2021-05-18T16:32:10.226Z',
                        dateDeleted: null,
                        dataVersion: null
                    },
                    {
                        id: 'mockfield2',
                        studyId: createdStudy.id,
                        fieldId: '32',
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: enumValueType.STRING,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dateAdded: '2022-06-18T17:35:15.226Z',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    },
                    {
                        id: 'mockfield1',
                        studyId: createdStudy.id,
                        fieldId: '31',
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: enumValueType.STRING,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dateAdded: '2021-05-16T16:32:10.226Z',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    }
                ].sort((a, b) => a.id.localeCompare(b.id)));
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
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: enumValueType.STRING,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dateAdded: '2022-06-18T17:35:15.226Z',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    },
                    {
                        id: 'mockfield1',
                        studyId: createdStudy.id,
                        fieldId: '31',
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: enumValueType.STRING,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dateAdded: '2021-05-16T16:32:10.226Z',
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    }
                ].sort((a, b) => a.id.localeCompare(b.id)));
                // clear database
                await db.collections!.field_dictionary_collection.deleteMany({ dataVersion: null });
            });

            test('Edit project approved fields with fields that are not in the field tree (admin) (should fail)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FIELDS),
                    variables: {
                        projectId: createdProject.id,
                        approvedFields: ['fakefieldhere']
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe('Some of the fields provided in your changes are not valid.');
                expect(res.body.data.editProjectApprovedFields).toBe(null);
            });


            test('Edit project approved fields (admin)', async () => {
                const tentativeApprovedFields = mockFields.map(el => el.id);
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FIELDS),
                    variables: {
                        projectId: createdProject.id,
                        approvedFields: tentativeApprovedFields
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editProjectApprovedFields).toEqual({
                    id: createdProject.id,
                    approvedFields: tentativeApprovedFields, // seen by study user
                    fields: [  // seen by project user
                        {
                            id: 'mockfield1',
                            studyId: createdStudy.id,
                            fieldId: '31',
                            fieldName: 'Sex',
                            tableName: null,
                            dataType: enumValueType.STRING,
                            possibleValues: [],
                            unit: 'person',
                            comments: 'mockComments1',
                            dateAdded: '2021-05-16T16:32:10.226Z',
                            dateDeleted: null,
                            dataVersion: 'mockDataVersionId'
                        },
                        {
                            id: 'mockfield2',
                            studyId: createdStudy.id,
                            fieldId: '32',
                            fieldName: 'Sex',
                            tableName: null,
                            dataType: enumValueType.STRING,
                            possibleValues: [],
                            unit: 'person',
                            comments: 'mockComments2',
                            dateAdded: '2022-06-18T17:35:15.226Z',
                            dateDeleted: null,
                            dataVersion: 'mockDataVersionId'
                        }
                    ]
                });
                /* cleanup: revert the adding of fields */
                await db.collections!.projects_collection.updateOne({ id: createdProject.id }, { $set: { approvedFields: [] } });
            });

            test('Edit project approved fields (user without privilege) (should fail)', async () => {
                const tentativeApprovedFields = mockFields.map(el => el.id);
                const res = await user.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FIELDS),
                    variables: {
                        projectId: createdProject.id,
                        approvedFields: tentativeApprovedFields
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editProjectApprovedFields).toEqual(null);
            });

            test('Edit project approved fields (user with study readonly privilege) (should fail)', async () => {
                const tentativeApprovedFields = mockFields.map(el => el.id);
                const res = await authorisedUserStudy.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FIELDS),
                    variables: {
                        projectId: createdProject.id,
                        approvedFields: tentativeApprovedFields
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editProjectApprovedFields).toEqual(null);
            });

            test('Edit project approved fields (user with study " manage project" privilege)', async () => {
                const tentativeApprovedFields = mockFields.map(el => el.id);
                const res = await authorisedUserStudyManageProject.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FIELDS),
                    variables: {
                        projectId: createdProject.id,
                        approvedFields: tentativeApprovedFields
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editProjectApprovedFields).toEqual({
                    id: createdProject.id,
                    approvedFields: tentativeApprovedFields, // seen by study user
                    fields: [  // seen by project user
                        {
                            id: 'mockfield1',
                            studyId: createdStudy.id,
                            fieldId: '31',
                            fieldName: 'Sex',
                            tableName: null,
                            dataType: enumValueType.STRING,
                            possibleValues: [],
                            unit: 'person',
                            comments: 'mockComments1',
                            dateAdded: '2021-05-16T16:32:10.226Z',
                            dateDeleted: null,
                            dataVersion: 'mockDataVersionId'
                        },
                        {
                            id: 'mockfield2',
                            studyId: createdStudy.id,
                            fieldId: '32',
                            fieldName: 'Sex',
                            tableName: null,
                            dataType: enumValueType.STRING,
                            possibleValues: [],
                            unit: 'person',
                            comments: 'mockComments2',
                            dateAdded: '2022-06-18T17:35:15.226Z',
                            dateDeleted: null,
                            dataVersion: 'mockDataVersionId'
                        }
                    ]
                });
                /* cleanup: revert the adding of fields */
                await db.collections!.projects_collection.updateOne({ id: createdProject.id }, { $set: { approvedFields: [] } });
            });

            test('Edit project approved fields (user with project privilege) (should fail)', async () => {
                const tentativeApprovedFields = mockFields.map(el => el.id);
                const res = await authorisedUser.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FIELDS),
                    variables: {
                        projectId: createdProject.id,
                        approvedFields: tentativeApprovedFields
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editProjectApprovedFields).toEqual(null);
            });

            test('Edit project approved files (user without privilege) (should fail)', async () => {
                const res = await user.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FILES),
                    variables: {
                        projectId: createdProject.id,
                        approvedFiles: [mockFiles[0].id]
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editProjectApprovedFiles).toEqual(null);
            });

            test('Edit project approved files (user with project privilege) (should fail)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FILES),
                    variables: {
                        projectId: createdProject.id,
                        approvedFiles: [mockFiles[0].id]
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editProjectApprovedFiles).toEqual(null);
            });

            test('Edit project approved files (user with study read-only privilege) (should fail)', async () => {
                const res = await authorisedUserStudy.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FILES),
                    variables: {
                        projectId: createdProject.id,
                        approvedFiles: [mockFiles[0].id]
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editProjectApprovedFiles).toEqual(null);
            });

            test('Edit project approved files (user with study "manage project" privilege)', async () => {
                const res = await authorisedUserStudyManageProject.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FILES),
                    variables: {
                        projectId: createdProject.id,
                        approvedFiles: [mockFiles[0].id]
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                const { editProjectApprovedFiles } = res.body.data;
                expect(editProjectApprovedFiles).toEqual({
                    id: createdProject.id,
                    approvedFiles: [mockFiles[0].id],
                    files: [{
                        id: mockFiles[0].id,
                        fileName: mockFiles[0].fileName,
                        studyId: createdStudy.id,
                        projectId: null,
                        fileSize: (mockFiles[0].fileSize as any).toString(),
                        description: mockFiles[0].description,
                        uploadedBy: adminId
                    }]
                });
                expect(typeof editProjectApprovedFiles.id).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].fileName).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].studyId).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].fileSize).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].description).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].uploadedBy).toEqual('string');

                /* cleanup: reverse adding project approvedfiles */
                await mongoClient.collection<IProject>(config.database.collections.projects_collection).updateOne({ id: createdProject.id }, { $set: { approvedFiles: [] } });
            });

            test('Edit project approved files (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FILES),
                    variables: {
                        projectId: createdProject.id,
                        approvedFiles: [mockFiles[0].id]
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                const { editProjectApprovedFiles } = res.body.data;
                expect(editProjectApprovedFiles).toEqual({
                    id: createdProject.id,
                    approvedFiles: [mockFiles[0].id],
                    files: [{
                        id: mockFiles[0].id,
                        fileName: mockFiles[0].fileName,
                        studyId: createdStudy.id,
                        projectId: null,
                        fileSize: (mockFiles[0].fileSize as any).toString(),
                        description: mockFiles[0].description,
                        uploadedBy: adminId
                    }]
                });
                expect(typeof editProjectApprovedFiles.id).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].fileName).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].studyId).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].fileSize).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].description).toEqual('string');
                expect(typeof editProjectApprovedFiles.files[0].uploadedBy).toEqual('string');

                /* cleanup: reverse adding project approvedfiles */
                await mongoClient.collection<IProject>(config.database.collections.projects_collection).updateOne({ id: createdProject.id }, { $set: { approvedFiles: [] } });
            });

            test('Edit project approved files for non-existnet file (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_PROJECT_APPROVED_FILES),
                    variables: {
                        projectId: createdProject.id,
                        approvedFiles: ['Idontexist!']
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe('Some of the files provided in your changes are not valid.');
                expect(res.body.data.editProjectApprovedFiles).toBe(null);
            });

            test('Set a previous study dataversion as current (admin)', async () => {
                /* setup: add an extra dataversion */
                await db.collections!.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });
                const res = await admin.post('/graphql').send({
                    query: print(SET_DATAVERSION_AS_CURRENT),
                    variables: {
                        studyId: createdStudy.id,
                        dataVersionId: mockDataVersion.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                const study = await db.collections!.studies_collection.findOne<IStudy>({ id: createdStudy.id }, { projection: { dataVersions: 1 } });
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
                await db.collections!.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

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
                await db.collections!.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

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
                await db.collections!.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

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

            test('Set a previous study dataversion as current (user with study "manage project" privilege) (should fail)', async () => {
                /* setup: add an extra dataversion */
                await db.collections!.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

                const res = await authorisedUserStudyManageProject.post('/graphql').send({
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
                    type: userTypes.STANDARD,
                    description: 'just a data curator',
                    resetPasswordRequests: [],
                    emailNotificationsActivated: true,
                    deleted: null,
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000
                };
                await db.collections!.users_collection.insertOne(userDataCurator);

                /* setup: create a new role with data management */
                const roleDataCurator: any = {
                    id: uuid(),
                    studyId: createdStudy.id,
                    name: 'Data Manager',
                    permissions: [permissions.specific_study.specific_study_data_management],
                    users: [userDataCurator.id],
                    createdBy: adminId,
                    deleted: null
                };
                await db.collections!.roles_collection.insertOne(roleDataCurator);

                /* setup: connect user */
                const dataCurator = request.agent(app);
                await connectAgent(dataCurator, userDataCurator.username, 'admin', userDataCurator.otpSecret);

                /* setup: add an extra dataversion */
                await db.collections!.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: newMockDataVersion }, $inc: { currentDataVersion: 1 } });

                /* test */
                const res = await dataCurator.post('/graphql').send({
                    query: print(SET_DATAVERSION_AS_CURRENT),
                    variables: {
                        studyId: createdStudy.id,
                        dataVersionId: mockDataVersion.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                const study = await db.collections!.studies_collection.findOne<IStudy>({ id: createdStudy.id }, { projection: { dataVersions: 1 } });
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

                /* cleanup: delete user and role */
                await db.collections!.users_collection.deleteOne({ id: userDataCurator.id });
                await db.collections!.roles_collection.deleteOne({ id: roleDataCurator.id });
            });

            test('Create New fields (admin)', async () => {
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
                expect(res.body.data.createNewField).toEqual([]);
                const fieldsInDb = await db.collections!.field_dictionary_collection.find({ studyId: createdStudy.id, dataVersion: null }).toArray();
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
                const fieldsInDb = await db.collections!.field_dictionary_collection.find({ studyId: createdStudy.id, dateDeleted: { $ne: null } }).toArray();
                expect(fieldsInDb).toHaveLength(1);
                expect(fieldsInDb[0].fieldId).toBe('8');
                // clear database
                await db.collections!.field_dictionary_collection.deleteMany({ studyId: createdStudy.id, fieldId: { $in: ['8', '9'] } });
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
                const fieldsInDb = await db.collections!.field_dictionary_collection.find({ studyId: createdStudy.id, fieldId: '8' }).toArray();
                expect(fieldsInDb).toHaveLength(2);
                expect(fieldsInDb[0].fieldId).toBe('8');
                expect(fieldsInDb[1].fieldId).toBe('8');
                expect(fieldsInDb[1].dateDeleted).not.toBe(null);
                // clear database
                await db.collections!.field_dictionary_collection.deleteMany({ studyId: createdStudy.id, fieldId: { $in: ['8', '9'] } });
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
            let mockFields: any[];
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
                            studyId: createdStudy.id,
                            projectId: null
                        }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();

                    createdRole_study_accessData = await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ name: roleName });
                    expect(createdRole_study_accessData).toEqual({
                        _id: createdRole_study_accessData._id,
                        id: createdRole_study_accessData.id,
                        projectId: null,
                        studyId: createdStudy.id,
                        name: roleName,
                        permissions: [],
                        createdBy: adminId,
                        users: [],
                        deleted: null
                    });
                    expect(res.body.data.addRoleToStudyOrProject).toEqual({
                        id: createdRole_study_accessData.id,
                        name: roleName,
                        permissions: [],
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
                        type: userTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}'@user.io'`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised study user managing project.',
                        emailNotificationsActivated: true,
                        organisation: 'organisation_system',
                        deleted: null,
                        id: `AuthorisedStudyUserManageProject_${username}`,
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
                    };

                    await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(newUser);
                    createdUserNoAuthorisedProfile = await mongoClient.collection<IUser>(config.database.collections.users_collection).findOne({ username });
                }

                /* 3. create an authorised study user that can manage projects (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: userTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}'@user.io'`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised study user managing project.',
                        emailNotificationsActivated: true,
                        organisation: 'organisation_system',
                        deleted: null,
                        id: `AuthorisedStudyUserManageProject_${username}`,
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
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
                                add: [permissions.specific_study.specific_study_data_management, permissions.specific_study.specific_study_readonly_access],
                                remove: []
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
                        permissions: [permissions.specific_study.specific_study_data_management, permissions.specific_study.specific_study_readonly_access],
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
                        type: userTypes.STANDARD,
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
                        dataType: enumValueType.INTEGER,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dateAdded: 100000000,
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    },
                    {
                        id: 'mockfield2',
                        studyId: createdStudy.id,
                        fieldId: '32',
                        fieldName: 'Sex',
                        dataType: enumValueType.STRING,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dateAdded: 100000000,
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    },
                    {
                        id: 'mockfield3',
                        studyId: createdStudy.id,
                        fieldId: '33',
                        fieldName: 'DeviceTest',
                        dataType: enumValueType.FILE,
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments3',
                        dateAdded: 100000000,
                        dateDeleted: null,
                        dataVersion: 'mockDataVersionId'
                    }
                ];
                await db.collections!.field_dictionary_collection.insertMany(mockFields);
                await db.collections!.studies_collection.updateOne({ id: createdStudy.id }, { $push: { dataVersions: mockDataVersion }, $inc: { currentDataVersion: 1 } });

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
                        name: projectName,
                        approvedFields: []
                    });
                }

                /* 5. create an authorised project user (no role yet) */
                {
                    const username = uuid();
                    const newUser: IUser = {
                        username: username,
                        type: userTypes.STANDARD,
                        firstname: `${username}_firstname`,
                        lastname: `${username}_lastname`,
                        password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                        otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                        email: `${username}@user.io`,
                        resetPasswordRequests: [],
                        description: 'I am an authorised project user.',
                        emailNotificationsActivated: true,
                        organisation: 'organisation_system',
                        deleted: null,
                        id: `AuthorisedProjectUser_${username}`,
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
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
                        permissions: [],
                        createdBy: adminId,
                        users: [],
                        deleted: null
                    });
                    expect(res.body.data.addRoleToStudyOrProject).toEqual({
                        id: createdRole_project.id,
                        name: roleName,
                        permissions: [],
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
                                add: [permissions.specific_project.specific_project_readonly_access],
                                remove: []
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
                        permissions: [permissions.specific_project.specific_project_readonly_access],
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
                        type: userTypes.STANDARD,
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
                        type: userTypes.ADMIN,
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
                        createdAt: 1591134065000,
                        expiredAt: 1991134065000
                    });

                    // study data is NOT deleted for audit purposes - unless explicitly requested separately
                    const roles = await db.collections!.roles_collection.find({ studyId: createdStudy.id, deleted: null }).toArray();
                    const projects = await db.collections!.projects_collection.find({ studyId: createdStudy.id, deleted: null }).toArray();
                    const study = await db.collections!.studies_collection.findOne({ id: createdStudy.id, deleted: null });
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

                await db.collections!.field_dictionary_collection.deleteMany({ studyId: createdStudy.id });
            });

            afterEach(async () => {
                await db.collections!.data_collection.deleteMany({});
                await db.collections!.studies_collection.findOneAndUpdate({ id: createdStudy.id }, {
                    $set: {
                        dataVersions: [{
                            id: 'mockDataVersionId',
                            contentId: 'mockContentId',
                            version: '0.0.1',
                            updateDate: '5000000'
                        }], currentDataVersion: 0
                    }
                });
                await db.collections!.field_dictionary_collection.deleteMany({ studyId: createdStudy.id, fieldId: { $nin: ['31', '32'] }, dataVersion: null });
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
                    { code: 'CLIENT_ACTION_ON_NON_EXISTENT_ENTRY', description: 'Field 34: Field Not found' },
                    { code: 'CLIENT_MALFORMED_INPUT', description: 'Field 31: Cannot parse as integer.' },
                    { code: 'CLIENT_MALFORMED_INPUT', description: 'Subject ID I777770 is illegal.' }
                ]);

                const dataInDb = await db.collections!.data_collection.find({ deleted: null }).toArray();
                expect(dataInDb).toHaveLength(2);
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
                const fileFirst = await db.collections!.files_collection.findOne<IFile>({ studyId: createdStudy.id, deleted: null });
                const dataFirst = await db.collections!.data_collection.findOne<IDataEntry>({ m_studyId: createdStudy.id, m_visitId: '1' });
                expect(dataFirst['33']).toBe(fileFirst.id);

                // upload again and check whether the old file has been deleted
                const resSecond = await authorisedUser.post('/graphql')
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
                                        postFix: 'test'
                                    }
                                }
                            ]
                        }
                    }))
                    .field('map', JSON.stringify({ 1: ['variables.data.0.file'] }))
                    .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));
                expect(resSecond.status).toBe(200);
                expect(resSecond.body.errors).toBeUndefined();
                const fileSecond = await db.collections!.files_collection.find<IFile>({ studyId: createdStudy.id, deleted: null }).toArray();
                const dataSecond = await db.collections!.data_collection.findOne<IDataEntry>({ m_studyId: createdStudy.id, m_visitId: '1' });
                expect(fileSecond).toHaveLength(1);
                expect(dataSecond['33']).toBe(fileSecond[0].id);
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
                const studyInDb = await db.collections!.studies_collection.findOne({ id: createdStudy.id });
                expect(studyInDb.dataVersions).toHaveLength(2);
                expect(studyInDb.dataVersions[1].version).toBe('1');
                expect(studyInDb.dataVersions[1].tag).toBe('testTag');
                const dataInDb = await db.collections!.data_collection.find({ m_studyId: createdStudy.id, m_versionId: createRes.body.data.createNewDataVersion.id }).toArray();
                expect(dataInDb).toHaveLength(3);
            });

            test('Create New data version with field only (user with study privilege)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_NEW_FIELD),
                    variables: {
                        studyId: createdStudy.id, fieldInput: {
                            fieldId: '34',
                            fieldName: 'Height',
                            dataType: enumValueType.DECIMAL,
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
                const studyInDb = await db.collections!.studies_collection.findOne({ id: createdStudy.id });
                expect(studyInDb.dataVersions).toHaveLength(2);
                expect(studyInDb.dataVersions[1].version).toBe('1');
                expect(studyInDb.dataVersions[1].tag).toBe('testTag');
                const fieldIndb = await db.collections!.field_dictionary_collection.find({ studyId: createdStudy.id, dataVersion: { $in: [createRes.body.data.createNewDataVersion.id, 'mockDataVersionId'] } }).toArray();
                expect(fieldIndb).toHaveLength(4);
            });

            test('Create New data version with field and data (user with study privilege)', async () => {
                await admin.post('/graphql').send({
                    query: print(CREATE_NEW_FIELD),
                    variables: {
                        studyId: createdStudy.id, fieldInput: {
                            fieldId: '34',
                            fieldName: 'Height',
                            dataType: enumValueType.DECIMAL,
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
                const studyInDb = await db.collections!.studies_collection.findOne({ id: createdStudy.id });
                expect(studyInDb.dataVersions).toHaveLength(2);
                expect(studyInDb.dataVersions[1].version).toBe('1');
                expect(studyInDb.dataVersions[1].tag).toBe('testTag');
                const dataInDb = await db.collections!.data_collection.find({ m_studyId: createdStudy.id, m_versionId: createRes.body.data.createNewDataVersion.id }).toArray();
                expect(dataInDb).toHaveLength(3);
                const fieldsInDb = await db.collections!.field_dictionary_collection.find({ studyId: createdStudy.id, dataVersion: { $in: [createRes.body.data.createNewDataVersion.id, 'mockDataVersionId'] } }).toArray();
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
                expect(deleteRes.body.data.deleteDataRecords).toEqual([]);
                const dataInDb = (await db.collections!.data_collection.find({}).sort({ uploadedAt: -1 }).limit(2).toArray()).sort((a, b) => {
                    return parseFloat(a.m_visitId) - parseFloat(b.m_visitId);
                });
                expect(dataInDb[0]['31']).toBe(null);
                expect(dataInDb[0]['32']).toBe(null);
                expect(dataInDb[0]['m_subjectId']).toBe('I7N3G6G');
                expect(dataInDb[0]['m_visitId']).toBe('1');
                expect(dataInDb[1]['31']).toBe(null);
                expect(dataInDb[1]['32']).toBe(null);
                expect(dataInDb[1]['m_subjectId']).toBe('I7N3G6G');
                expect(dataInDb[1]['m_visitId']).toBe('2');
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
                expect(deleteRes.body.data.deleteDataRecords).toEqual([]);
                const dataInDb = await db.collections!.data_collection.find({}).sort({ uploadedAt: -1 }).limit(2).toArray();
                expect(dataInDb[0]['31']).toBe(null);
                expect(dataInDb[0]['32']).toBe(null);
                expect(dataInDb[0]['m_visitId']).toBe('2');
                expect(dataInDb[1]['31']).toBe(null);
                expect(dataInDb[1]['32']).toBe(null);
                expect(dataInDb[1]['m_visitId']).toBe('2');
                expect(Array.from(new Set(dataInDb.map(el => el.m_subjectId))).length).toBe(2);
            });

            test('Delete data records: studyId (admin)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.uploadDataInArray).toEqual([]);

                const deleteRes = await admin.post('/graphql').send({
                    query: print(DELETE_DATA_RECORDS),
                    variables: { studyId: createdStudy.id }
                });
                expect(deleteRes.status).toBe(200);
                expect(deleteRes.body.errors).toBeUndefined();
                expect(deleteRes.body.data.deleteDataRecords).toEqual([]);
                const dataInDb = await db.collections!.data_collection.find({ 31: null }).sort({ uploadedAt: -1 }).toArray();
                expect(dataInDb).toHaveLength(4); // 2 visits * 2 subjects = 4 records
            });

            test('Delete data records: records not exist', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.uploadDataInArray).toEqual([]);

                const deleteRes = await admin.post('/graphql').send({
                    query: print(DELETE_DATA_RECORDS),
                    variables: { studyId: createdStudy.id, subjectIds: ['I7N3G6G'], visitIds: ['100', '101'] }
                });
                expect(deleteRes.status).toBe(200);
                expect(deleteRes.body.errors).toBeUndefined();
                expect(deleteRes.body.data.deleteDataRecords).toEqual([]);
                const dataInDb = await db.collections!.data_collection.find({ m_subjectId: 'I7N3G6G' }).sort({ uploadedAt: -1 }).toArray();
                expect(dataInDb).toHaveLength(4); // two data records, two deleted records
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
                const getRes = await authorisedUser.post('/graphql').send({
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

            test('Get data records (user with project privilege)', async () => {
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
                        studyId: createdStudy.id,
                        data: [
                            {
                                fieldId: '31',
                                value: '10',
                                subjectId: 'I7N3G6G',
                                visitId: '3'
                            }
                        ]
                    }
                });
                const getRes = await authorisedProjectUser.post('/graphql').send({
                    query: print(GET_DATA_RECORDS),
                    variables: {
                        studyId: createdStudy.id,
                        projectId: createdProject.id,
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
                                    name: '',
                                    field: ['$200'],
                                    visitRange: []
                                }
                            ]
                        }
                    }
                });
                const study = await db.collections!.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.createOntologyTree).toEqual({
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
                    ]
                });
                // clear ontologyTrees
                await db.collections!.studies_collection.findOneAndUpdate({ id: createdStudy.id, deleted: null }, {
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
                const study: IStudy = await db.collections!.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                const res = await authorisedUser.post('/graphql').send({
                    query: print(DELETE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        treeId: study.ontologyTrees[0].id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.deleteOntologyTree).toEqual({
                    id: study.ontologyTrees[0].id,
                    successful: true
                });
                const updatedStudy: IStudy = await db.collections!.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                expect(updatedStudy.ontologyTrees.length).toBe(0);
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
                const study: IStudy = await db.collections!.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                const res = await user.post('/graphql').send({
                    query: print(DELETE_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        treeId: study.ontologyTrees[0].id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.deleteOntologyTree).toBe(null);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                await db.collections!.studies_collection.findOneAndUpdate({ studyId: createdStudy.id, deleted: null }, {
                    $set: {
                        ontologyTrees: []
                    }
                });
            });

            test('Get an ontology tree (authorised user)', async () => {
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
                const study: IStudy = await db.collections!.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                const res = await authorisedUser.post('/graphql').send({
                    query: print(GET_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdStudy.id,
                        treeId: null
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.getOntologyTree).toHaveLength(1);
                expect(res.body.data.getOntologyTree[0]).toEqual({
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
                    ]
                });
                await db.collections!.studies_collection.findOneAndUpdate({ studyId: createdStudy.id, deleted: null }, {
                    $set: {
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
                const res = await user.post('/graphql').send({
                    query: print(GET_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdProject.studyId,
                        projectId: createdProject.id,
                        treeId: null
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.getOntologyTree).toBe(null);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                await db.collections!.studies_collection.findOneAndUpdate({ studyId: createdStudy.id, deleted: null }, {
                    $set: {
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
                const study: IStudy = await db.collections!.studies_collection.findOne({ id: createdStudy.id, deleted: null });
                const res = await authorisedUser.post('/graphql').send({
                    query: print(GET_ONTOLOGY_TREE),
                    variables: {
                        studyId: createdProject.studyId,
                        projectId: createdProject.id,
                        treeId: null
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.data.getOntologyTree).toHaveLength(1);
                expect(res.body.data.getOntologyTree[0]).toEqual({
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
                    ]
                });
                await db.collections!.studies_collection.findOneAndUpdate({ studyId: createdStudy.id, deleted: null }, {
                    $set: {
                        ontologyTrees: []
                    }
                });
            });

            test('Check data complete (admin)', async () => {
                await admin.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                // edit a field so that the datatype mismatched with the exisiting value
                // this happens when a field is deleted first and then modified and added, while some data has been uploaded before deleting, causing conflicts
                await db.collections!.field_dictionary_collection.findOneAndUpdate({
                    studyId: createdStudy.id,
                    fieldId: '32'
                }, {
                    $set: {
                        dataType: enumValueType.DECIMAL
                    }
                });

                const checkRes = await admin.post('/graphql').send({
                    query: print(CHECK_DATA_COMPLETE),
                    variables: { studyId: createdStudy.id }
                });
                expect(checkRes.status).toBe(200);
                expect(checkRes.body.errors).toBeUndefined();
                expect(checkRes.body.data.checkDataComplete).toEqual([
                    {
                        subjectId: 'I7N3G6G',
                        visitId: '1',
                        errorFields: ['Field 32-Sex: Cannot parse as decimal.']
                    },
                    {
                        subjectId: 'I7N3G6G',
                        visitId: '2',
                        errorFields: ['Field 32-Sex: Cannot parse as decimal.']
                    },
                    {
                        subjectId: 'GR6R4AR',
                        visitId: '2',
                        errorFields: ['Field 32-Sex: Cannot parse as decimal.']
                    }
                ]);
            });
        });
    });
} else
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });

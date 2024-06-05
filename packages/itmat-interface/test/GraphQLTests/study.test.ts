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
    WHO_AM_I,
    CREATE_STUDY,
    DELETE_STUDY,
    SET_DATAVERSION_AS_CURRENT,
    EDIT_STUDY,
    UPLOAD_DATA_IN_ARRAY,
    DELETE_DATA_RECORDS,
    GET_DATA_RECORDS,
    CREATE_NEW_DATA_VERSION,
    CREATE_NEW_FIELD,
    DELETE_FIELD
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
    IRole,
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

        describe('MINI END-TO-END API TEST, NO UI, NO DATA', () => {
            let createdStudy: { id: any; name: any; };
            let authorisedUserProfile: { id: any; firstname: any; lastname: any; username: string; otpSecret: string; };  // profile
            let authorisedUser: request.SuperTest<request.Test>; // client
            let mockFields: IField[];
            let mockFiles: IFile[];
            let mockDataVersion: IStudyDataVersion;
            let newRole: IRole;
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
                        },
                        {
                            id: 'mockfile1',
                            studyId: createdStudy.id,
                            fieldId: 'mockfield_file',
                            dataVersion: mockDataVersion.id,
                            value: 'mockfile1_id',
                            properties: {
                                description: 'Just a test file1'
                            },
                            life: {
                                createdTime: 10003,
                                createdUser: 'admin',
                                deletedTime: null,
                                deletedUser: null
                            },
                            metadata: {}
                        },
                        {
                            id: 'mockfile2',
                            studyId: createdStudy.id,
                            fieldId: 'mockfield_file',
                            dataVersion: mockDataVersion.id,
                            value: 'mockfile2_id',
                            properties: {
                                description: 'Just a test file2'
                            },
                            life: {
                                createdTime: 10004,
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
                            properties: [{
                                name: 'm_subjectId',
                                required: true
                            }, {
                                name: 'm_visitId',
                                required: true
                            }],
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
                            properties: [{
                                name: 'm_subjectId',
                                required: true
                            }, {
                                name: 'm_visitId',
                                required: true
                            }],
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
                        },
                        {
                            id: 'mockfield_file',
                            studyId: createdStudy.id,
                            fieldId: 'mockfield_file',
                            fieldName: 'File',
                            dataType: enumDataTypes.FILE,
                            categoricalOptions: [],
                            properties: [{
                                name: 'description',
                                required: true
                            }],
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

                /* setup: creating a privileged user */
                const username = uuid();
                authorisedUserProfile = {
                    username,
                    type: 'STANDARD',
                    firstname: `${username}_firstname`,
                    lastname: `${username}_lastname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'organisation_system',
                    id: `new_user_id_${username}`,
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
                newRole = {
                    id: roleId,
                    studyId: createdStudy.id,
                    name: `${roleId}_rolename`,
                    dataPermissions: [{
                        fields: ['^.*$'],
                        dataProperties: {},
                        includeUnVersioned: true,
                        permission: 7
                    }],
                    studyRole: 'STUDY_MANAGER',
                    users: [authorisedUserProfile.id],
                    life: {
                        createdTime: 1591134065000,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IRole>(config.database.collections.roles_collection).insertOne(newRole);

                authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);
            });

            afterAll(async () => {
                /* cleanup: delete study */
                await db.collections.studies_collection.deleteMany({});
                await db.collections.data_collection.deleteMany({});
                await db.collections.field_dictionary_collection.deleteMany({});
                await db.collections.files_collection.deleteMany({});
                await db.collections.roles_collection.deleteMany({});
                await db.collections.projects_collection.deleteMany({});
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

            test('Get study (admin)', async () => {
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
                    roles: [{
                        id: newRole.id,
                        name: `${newRole.id}_rolename`,
                        permissions: null,
                        projectId: null,
                        studyId: createdStudy.id,
                        description: null,
                        users: [{
                            id: authorisedUserProfile.id,
                            username: authorisedUserProfile.username,
                            firstname: authorisedUserProfile.firstname,
                            lastname: authorisedUserProfile.lastname,
                            organisation: 'organisation_system'
                        }]
                    }],
                    projects: [],
                    files: [],
                    numOfRecords: [0, 0],
                    subjects: [[], []],
                    visits: [[], []],
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
                const res = await authorisedUser.post('/graphql').send({
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
                    roles: [{
                        id: newRole.id,
                        name: `${newRole.id}_rolename`,
                        permissions: null,
                        projectId: null,
                        studyId: createdStudy.id,
                        description: null,
                        users: [{
                            id: authorisedUserProfile.id,
                            username: authorisedUserProfile.username,
                            firstname: authorisedUserProfile.firstname,
                            lastname: authorisedUserProfile.lastname,
                            organisation: 'organisation_system'
                        }]
                    }],
                    projects: [],
                    files: [{
                        id: 'mockfile1_id',
                        fileName: 'I7N3G6G-MMM7N3G6G-20200704-20210429.txt',
                        studyId: createdStudy.id,
                        projectId: null,
                        fileSize: '1000',
                        description: 'Just a test file1',
                        uploadTime: '1599345644000',
                        uploadedBy: adminId,
                        hash: 'b0dc2ae76cdea04dcf4be7fcfbe36e2ce8d864fe70a1895c993ce695274ba7a0',
                        metadata: {}
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
                        hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a3',
                        metadata: {}
                    }],
                    numOfRecords: [0, 0],
                    subjects: [[], []],
                    visits: [[], []],
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
            });

            test('Get study fields (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(GET_STUDY_FIELDS),
                    variables: {
                        studyId: createdStudy.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.getStudy).toBeUndefined();
            });

            test('Get study fields (user project privilege)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(GET_STUDY_FIELDS),
                    variables: {
                        studyId: createdStudy.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.getStudyFields).toEqual([
                    {
                        id: 'mockfield1',
                        studyId: createdStudy.id,
                        fieldId: '31',
                        fieldName: 'Sex',
                        tableName: null,
                        dataType: 'str',
                        dataVersion: 'mockDataVersionId',
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments1',
                        dateAdded: '10000',
                        dateDeleted: null
                    },
                    {
                        id: 'mockfield2',
                        studyId: createdStudy.id,
                        fieldId: '32',
                        fieldName: 'Race',
                        tableName: null,
                        dataType: 'str',
                        dataVersion: 'mockDataVersionId',
                        possibleValues: [],
                        unit: 'person',
                        comments: 'mockComments2',
                        dateAdded: '20000',
                        dateDeleted: null
                    },
                    {
                        id: 'mockfield_file',
                        studyId: createdStudy.id,
                        fieldId: 'mockfield_file',
                        fieldName: 'File',
                        tableName: null,
                        dataType: 'file',
                        dataVersion: 'mockDataVersionId',
                        possibleValues: [],
                        unit: null,
                        comments: null,
                        dateAdded: '20000',
                        dateDeleted: null
                    }
                ]);
            });

            test('Get study fields (user without privilege) (should fail)', async () => {
                const res = await user.post('/graphql').send({
                    query: print(GET_STUDY_FIELDS),
                    variables: {
                        studyId: createdStudy.id
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
                        createdUser: 'admin',
                        deletedTime: 30000,
                        deletedUser: 'admin'
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

                // user with privilege can access all latest field, including unversioned
                const res = await authorisedUser.post('/graphql').send({
                    query: print(GET_STUDY_FIELDS),
                    variables: {
                        studyId: createdStudy.id,
                        versionId: null
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.getStudyFields.map(el => el.id)).toEqual(['mockfield1', 'mockfield3', 'mockfield_file']);
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

            test('Create New fields (authorised user)', async () => {
                await db.collections.field_dictionary_collection.deleteMany({ dataVersion: null });
                const res = await authorisedUser.post('/graphql').send({
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
                await db.collections.field_dictionary_collection.deleteMany({ studyId: createdStudy.id, fieldId: { $in: ['8', '9'] } });
            });

            test('Create New field with unsupported characters (authorised user)', async () => {
                const res = await authorisedUser.post('/graphql').send({
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

            test('Create New fields (admin, should fail)', async () => {
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
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            });

            test('Delete an unversioned field (authorised user)', async () => {
                await authorisedUser.post('/graphql').send({
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
                const res = await authorisedUser.post('/graphql').send({
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

            test('Delete an unversioned field (admin, should fail)', async () => {
                await authorisedUser.post('/graphql').send({
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
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                await db.collections.field_dictionary_collection.deleteMany({ studyId: createdStudy.id, fieldId: { $in: ['8', '9'] } });
            });

            test('Delete a versioned field (authorised user)', async () => {
                await authorisedUser.post('/graphql').send({
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
                await authorisedUser.post('/graphql').send({
                    query: print(CREATE_NEW_DATA_VERSION),
                    variables: { studyId: createdStudy.id, dataVersion: '1', tag: 'testTag' }
                });
                const res = await authorisedUser.post('/graphql').send({
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
            let authorisedUserProfile;
            let authorisedUser: request.SuperTest<request.Test>;
            let mockFields: IField[];
            let mockDataVersion: IStudyDataVersion;
            let newRole: IRole;
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

                /* setup: creating a privileged user */
                const username = uuid();
                authorisedUserProfile = {
                    username,
                    type: 'STANDARD',
                    firstname: `${username}_firstname`,
                    lastname: `${username}_lastname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'organisation_system',
                    id: `new_user_id_${username}`,
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
                newRole = {
                    id: roleId,
                    studyId: createdStudy.id,
                    name: `${roleId}_rolename`,
                    dataPermissions: [{
                        fields: ['^.*$'],
                        dataProperties: {},
                        includeUnVersioned: true,
                        permission: 7
                    }],
                    studyRole: 'STUDY_MANAGER',
                    users: [authorisedUserProfile.id],
                    life: {
                        createdTime: 1591134065000,
                        createdUserId: 'admin',
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                };
                await mongoClient.collection<IRole>(config.database.collections.roles_collection).insertOne(newRole);

                authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

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
                        properties: [{
                            name: 'm_subjectId',
                            required: true
                        }, {
                            name: 'm_visitId',
                            required: true
                        }],
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
                        properties: [{
                            name: 'm_subjectId',
                            required: true
                        }, {
                            name: 'm_visitId',
                            required: true
                        }],
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
                        properties: [{
                            name: 'm_subjectId',
                            required: true
                        }, {
                            name: 'm_visitId',
                            required: true
                        }],
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
                await db.collections.field_dictionary_collection.insertMany(mockFields);
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

            });

            afterAll(async () => {
                /* cleanup: delete study */
                await db.collections.studies_collection.deleteMany({});
                await db.collections.data_collection.deleteMany({});
                await db.collections.field_dictionary_collection.deleteMany({});
                await db.collections.users_collection.deleteMany({});
                await db.collections.files_collection.deleteMany({});
                await db.collections.roles_collection.deleteMany({});
                await db.collections.projects_collection.deleteMany({});
            });

            beforeEach(async () => {
                await db.collections.data_collection.deleteMany({});
                await db.collections.field_dictionary_collection.deleteMany({ fieldId: { $nin: mockFields.map(el => el.fieldId) } });
                await db.collections.studies_collection.updateOne({ id: createdStudy.id }, { $set: { currentDataVersion: 0, dataVersions: [mockDataVersion], ontologyTrees: [] } });
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

                const dataInDb = await db.collections.data_collection.find({ deleted: null }).toArray();
                expect(dataInDb).toHaveLength(3);
            });

            test('Upload a data record to study (unauthorised user)', async () => {
                const res = await user.post('/graphql').send({
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
                const res = await authorisedUser.post('/graphql').send({
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
                const res = await authorisedUser.post('/graphql').send({
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
                await authorisedUser.post('/graphql').send({
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
                await authorisedUser.post('/graphql').send({
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
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-33 is deleted.' }
                ]);
            });

            test('Delete data records: visitId (admin)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(UPLOAD_DATA_IN_ARRAY),
                    variables: { studyId: createdStudy.id, data: multipleRecords }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();

                const deleteRes = await admin.post('/graphql').send({
                    query: print(DELETE_DATA_RECORDS),
                    variables: { studyId: createdStudy.id, visitIds: ['2'] }
                });
                expect(deleteRes.status).toBe(200);
                expect(deleteRes.body.errors).toHaveLength(1);
                expect(deleteRes.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            });

            test('Delete data records: studyId (authorised user)', async () => {
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
                const deleteRes = await authorisedUser.post('/graphql').send({
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
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-33 is deleted.' }
                ]);
                const dataInDb = await db.collections.data_collection.find({}).sort({ 'life.createdTime': -1 }).toArray();
                expect(dataInDb).toHaveLength(18); // 2 visits * 2 subjects * 2 fields * 2 (delete or not) + 6 (original records) = 22 records
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
                const deleteRes = await authorisedUser.post('/graphql').send({
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
                    { successful: true, id: null, code: null, description: 'SubjectId-I7N3G6G:visitId-2:fieldId-33 is deleted.' }
                ]);
                const dataInDb = await db.collections.data_collection.find({}).sort({ 'life.createdTime': -1 }).toArray();
                expect(dataInDb).toHaveLength(12); // 8 deleted records and 6 original records
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
        });
    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}

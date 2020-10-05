import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { v4 as uuid } from 'uuid';
import { errorCodes } from '../../src/graphql/errors';
import { MongoClient } from 'mongodb';
import * as itmatCommons from 'itmat-commons';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from 'itmat-setup';
import config from '../../config/config.sample.json';
const { CREATE_DATA_CURATION_JOB } = itmatCommons.GQLRequests;
const { permissions } = itmatCommons;

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
    await db.connect(config.database, MongoClient.connect);
    const router = new Router(config);

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

describe('JOB API', () => {
    let adminId;
    let createdStudy;
    let createdFile;

    beforeAll(async () => {
        /* setup: first retrieve the generated user id */
        const result = await mongoClient.collection(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
        adminId = result.filter(e => e.username === 'admin')[0].id;
    });

    beforeEach(async () => {
        /* setup: create a study to upload file to */
        const studyname = uuid();
        createdStudy = {
            id: `new_study_id_${studyname}`,
            name: studyname,
            createdBy: 'admin',
            lastModified: 200000002,
            deleted: null,
            currentDataVersion: -1,
            dataVersions: []
        };
        await mongoClient.collection(config.database.collections.studies_collection).insertOne(createdStudy);

        /* setup: created file entry in the database */
        const fileName = uuid();
        createdFile = {
            id: `new_file_id_${fileName}`,
            fileName: fileName + '.csv',
            studyId: createdStudy.id,
            fileSize: 1000,
            description: 'just a test file here.',
            uploadedBy: adminId,
            uri: `new_file_uri_${fileName}`,
            deleted: null
        };
        await mongoClient.collection(config.database.collections.files_collection).insertOne(createdFile);
    });

    test('Create a data curation job with tag (admin)', async () => {
        const res = await admin.post('/graphql').send({
            query: print(CREATE_DATA_CURATION_JOB),
            variables: {
                file: createdFile.id,
                studyId: createdStudy.id,
                tag: 'test_tag',
                version: '2.1'
            }
        });
        expect(res.status).toBe(200);
        expect(res.body.errors).toBeUndefined();
        const job = await mongoClient.collection(config.database.collections.jobs_collection).findOne({
            receivedFiles: createdFile.id
        });
        expect(res.body.data.createDataCurationJob).toEqual({
            id: job.id,
            studyId: createdStudy.id,
            projectId: null,
            jobType: 'DATA_UPLOAD_CSV',
            requester: adminId,
            requestTime: job.requestTime,
            receivedFiles: [createdFile.id],
            status: 'QUEUED',
            error: null,
            cancelled: false,
            cancelledTime: null,
            data: {
                versionTag: 'test_tag',
                dataVersion: '2.1'
            }
        });
    });

    test('Create a data curation job without tag (admin)', async () => {
        const res = await admin.post('/graphql').send({
            query: print(CREATE_DATA_CURATION_JOB),
            variables: {
                file: createdFile.id,
                studyId: createdStudy.id,
                tag: undefined,
                version: '2.1'
            }
        });
        expect(res.status).toBe(200);
        expect(res.body.errors).toBeUndefined();
        const job = await mongoClient.collection(config.database.collections.jobs_collection).findOne({
            receivedFiles: createdFile.id
        });
        expect(res.body.data.createDataCurationJob).toEqual({
            id: job.id,
            studyId: createdStudy.id,
            projectId: null,
            jobType: 'DATA_UPLOAD_CSV',
            requester: adminId,
            requestTime: job.requestTime,
            receivedFiles: [createdFile.id],
            status: 'QUEUED',
            error: null,
            cancelled: false,
            cancelledTime: null,
            data: {
                dataVersion: '2.1'
            }
        });
    });

    test('Create a data curation job (user with no privilege)', async () => {
        const res = await user.post('/graphql').send({
            query: print(CREATE_DATA_CURATION_JOB),
            variables: {
                file: createdFile.id,
                studyId: createdStudy.id,
                tag: 'just_a_tag',
                version: '2.1'
            }
        });
        expect(res.status).toBe(200);
        expect(res.body.errors).toHaveLength(1);
        expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
        const job = await mongoClient.collection(config.database.collections.jobs_collection).findOne({
            receivedFiles: createdFile.id
        });
        expect(job).toBe(null);
    });

    test('Create a data curation job (user with privilege)', async () => {
        /* setup: creating a privileged user */
        const username = uuid();
        const authorisedUserProfile = {
            username,
            type: 'STANDARD',
            realName: `${username}_realname`,
            password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
            otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
            email: `${username}@example.com`,
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
            studyId: createdStudy.id,
            name: `${roleId}_rolename`,
            permissions: [
                permissions.dataset_specific.data.upload_new_clinical_data
            ],
            users: [authorisedUserProfile.id],
            deleted: null
        };
        await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

        const authorisedUser = request.agent(app);
        await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

        /* test */
        const res = await authorisedUser.post('/graphql').send({
            query: print(CREATE_DATA_CURATION_JOB),
            variables: {
                file: createdFile.id,
                studyId: createdStudy.id,
                tag: 'just_a_tag',
                version: '2.1'
            }
        });
        expect(res.status).toBe(200);
        expect(res.body.errors).toBeUndefined();
        const job = await mongoClient.collection(config.database.collections.jobs_collection).findOne({
            receivedFiles: createdFile.id
        });
        expect(res.body.data.createDataCurationJob).toEqual({
            id: job.id,
            studyId: createdStudy.id,
            projectId: null,
            jobType: 'DATA_UPLOAD_CSV',
            requester: authorisedUserProfile.id,
            requestTime: job.requestTime,
            receivedFiles: [createdFile.id],
            status: 'QUEUED',
            error: null,
            cancelled: false,
            cancelledTime: null,
            data: {
                dataVersion: '2.1',
                versionTag: 'just_a_tag'
            }
        });
    });

    test('Create a data curation job with a non-existent file id (admin)', async () => {
        const res = await admin.post('/graphql').send({
            query: print(CREATE_DATA_CURATION_JOB),
            variables: {
                file: 'fake_file_id',
                studyId: createdStudy.id,
                tag: 'just_a_tag',
                version: '2.1'
            }
        });
        expect(res.status).toBe(200);
        expect(res.body.errors).toHaveLength(1);
        expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        const job = await mongoClient.collection(config.database.collections.jobs_collection).findOne({
            receivedFiles: createdFile.id
        });
        expect(job).toBe(null);
    });

    test('Create a data curation job with a non-existent study id (admin)', async () => {
        const res = await admin.post('/graphql').send({
            query: print(CREATE_DATA_CURATION_JOB),
            variables: {
                file: createdFile.id,
                studyId: 'fake_study_id',
                tag: 'just_a_tag',
                version: '2.1'
            }
        });
        expect(res.status).toBe(200);
        expect(res.body.errors).toHaveLength(1);
        expect(res.body.errors[0].message).toBe('Study does not exist.');
        const job = await mongoClient.collection(config.database.collections.jobs_collection).findOne({
            receivedFiles: createdFile.id
        });
        expect(job).toBe(null);
    });

    test('Create a data curation job with a non-existent study id (user)', async () => {
        const res = await user.post('/graphql').send({
            query: print(CREATE_DATA_CURATION_JOB),
            variables: {
                file: createdFile.id,
                studyId: 'fake_study_id',
                tag: 'just_a_tag',
                version: '2.1'
            }
        });
        expect(res.status).toBe(200);
        expect(res.body.errors).toHaveLength(1);
        expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
        const job = await mongoClient.collection(config.database.collections.jobs_collection).findOne({
            receivedFiles: createdFile.id
        });
        expect(job).toBe(null);
    });

    test('Create a data curation job with a malformed version id (admin)', async () => {
        const res = await admin.post('/graphql').send({
            query: print(CREATE_DATA_CURATION_JOB),
            variables: {
                file: createdFile.id,
                studyId: createdStudy.id,
                tag: 'just_a_tag',
                version: '2-3.1'
            }
        });
        expect(res.status).toBe(200);
        expect(res.body.errors).toHaveLength(1);
        expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_MALFORMED_INPUT);
        const job = await mongoClient.collection(config.database.collections.jobs_collection).findOne({
            receivedFiles: createdFile.id
        });
        expect(job).toBe(null);
    });
});

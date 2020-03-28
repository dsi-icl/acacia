const request = require('supertest');
const { print } = require('graphql');
const { connectAdmin, connectUser, connectAgent } = require('./_loginHelper');
const { db } = require('../../src/database/database');
const { Router } = require('../../src/server/router');
const fs = require('fs');
const { errorCodes } = require('../../src/graphql/errors');
const { MongoClient } = require('mongodb');
const itmatCommons = require('itmat-commons');
const { UPLOAD_FILE, WHO_AM_I, CREATE_PROJECT, CREATE_STUDY, DELETE_STUDY } = itmatCommons.GQLRequests;
const { MongoMemoryServer } = require('mongodb-memory-server');
const setupDatabase = require('itmat-utils/src/databaseSetup/collectionsAndIndexes');
const config = require('../../config/config.sample.json');
const { Models, permissions } = itmatCommons;

let app;
let mongodb;
let admin;
let user;
let mongoConnection;
let mongoClient;

afterAll(async () => {
    await db.closeConnection();
    await mongoConnection.close();
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

describe('FILE API', () => {
    let adminId;
    let userId;

    beforeAll(async () => {
        /* setup: first retrieve the generated user id */
        const result = await mongoClient.collection(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
        adminId = result.filter(e => e.username === 'admin')[0].id;
        userId = result.filter(e => e.username === 'standardUser')[0].id;
    });

    describe('UPLOAD AND DOWNLOAD FILE', () => {
        test.only('Upload file to study (admin)', async () => { 
            /* setup: create a study to upload file to */
            const createStudyRes = await admin.post('/graphql').send({
                query: print(CREATE_STUDY),
                variables: { name: 'new_study_1' }
            });
            expect(createStudyRes.status).toBe(200);
            expect(createStudyRes.body.data.errors).toBeUndefined();

            const createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: 'new_study_1' });
            expect(createStudyRes.body.data.createStudy).toEqual({
                id: createdStudy.id,
                name: 'new_study_1'
            });

            const res = await admin.post('/graphql').send({
                query: print(UPLOAD_FILE),
                variables: {
                    studyId: createdStudy.id,
                    file: fs.createReadStream('../filesForTests/just_a_test_file.txt'),
                    description: 'just a file 1.',
                    fileLength: 10000
                }
            });
            console.log(res.body);
            expect(res).toBe(200);
            expect(res.body.data.errors).toBeUndefined();
            expect(res.body.data.whoAmI).toEqual({
                id: 'fsf',
                fileName: 'just_a_test_file.txt',
                studyId: createdStudy.id,
                projectId: null,
                fileSize: 10000,
                description: 'just a file 1.',
                uploadedBy: 'admin'
            });
        });

        test('Upload file to study (user with privilege)', async () => {

        });

        test('Upload file to study (user with no privilege) (should fail)', async () => {

        });

        test('Download file from study (admin)', async () => {

        });

        test('Download file from study (user with privilege)', async () => {

        });

        test('Download file from study (user with no privilege) (should fail)', async () => {

        });
    });

    describe('FILE PERMISSION FOR PROJECTS', () => {
        test('1 + 1', () => {
            expect(2).toBe(2);
        });
    });
});
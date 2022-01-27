/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { objStore } from '../../src/objStore/objStore';
import { Router } from '../../src/server/router';
import path from 'path';
import { v4 as uuid } from 'uuid';
import chalk from 'chalk';
import { errorCodes } from '../../src/graphql/errors';
import { MongoClient } from 'mongodb';
import * as itmatCommons from 'itmat-commons';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from 'itmat-setup';
import config from '../../config/config.sample.json';
import { studyType } from 'itmat-commons';
const { UPLOAD_FILE, CREATE_STUDY, DELETE_FILE } = itmatCommons.GQLRequests;
const { permissions } = itmatCommons;

if (global.hasMinio) {
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
        mongodb = await MongoMemoryServer.create();
        const connectionString = mongodb.getUri();
        const database = mongodb.instanceInfo.dbName;
        await setupDatabase(connectionString, database);

        /* Wiring up the backend server */
        config.objectStore.port = global.minioContainerPort;
        config.database.mongo_url = connectionString;
        config.database.database = database;
        await db.connect(config.database, MongoClient.connect as any);
        await objStore.connect(config.objectStore);
        const router = new Router(config);

        /* Connect mongo client (for test setup later / retrieve info later) */
        mongoConnection = await MongoClient.connect(connectionString);
        mongoClient = mongoConnection.db(database);

        /* Connecting clients for testing later */
        app = router.getApp();
        admin = request.agent(app);
        user = request.agent(app);
        await connectAdmin(admin);
        await connectUser(user);
    }, 10000);

    describe('FILE API', () => {
        let adminId;

        beforeAll(async () => {
            /* setup: first retrieve the generated user id */
            const result = await mongoClient.collection(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
            adminId = result.filter(e => e.username === 'admin')[0].id;
        });

        describe('UPLOAD AND DOWNLOAD FILE', () => {
            describe('UPLOAD FILE', () => {
                /* note: a new study is created and a special authorised user for study permissions */
                let createdStudy;
                let createdStudyClinical;
                let createdStudyAny;
                let authorisedUser;
                let authorisedUserProfile;
                beforeEach(async () => {
                    /* setup: create a study to upload file to */
                    const studyname = uuid();
                    const createStudyRes = await admin.post('/graphql').send({
                        query: print(CREATE_STUDY),
                        variables: { name: studyname, description: 'test description', type: studyType.SENSOR }
                    });
                    expect(createStudyRes.status).toBe(200);
                    expect(createStudyRes.body.errors).toBeUndefined();

                    const studynameCLINICAL = uuid();
                    const createCLINICALStudyRes = await admin.post('/graphql').send({
                        query: print(CREATE_STUDY),
                        variables: { name: studynameCLINICAL, description: 'test description', type: studyType.CLINICAL }
                    });
                    expect(createCLINICALStudyRes.status).toBe(200);
                    expect(createCLINICALStudyRes.body.errors).toBeUndefined();

                    const studynameANY = uuid();
                    const createANYStudyRes = await admin.post('/graphql').send({
                        query: print(CREATE_STUDY),
                        variables: { name: studynameANY, description: 'test description', type: studyType.ANY }
                    });
                    expect(createANYStudyRes.status).toBe(200);
                    expect(createANYStudyRes.body.errors).toBeUndefined();


                    /* setup: getting the created study Id */
                    createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: studyname });
                    expect(createStudyRes.body.data.createStudy).toEqual({
                        id: createdStudy.id,
                        name: studyname,
                        description: 'test description',
                        type: studyType.SENSOR
                    });

                    createdStudyClinical = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: studynameCLINICAL });
                    expect(createCLINICALStudyRes.body.data.createStudy).toEqual({
                        id: createdStudyClinical.id,
                        name: studynameCLINICAL,
                        description: 'test description',
                        type: studyType.CLINICAL
                    });

                    createdStudyAny = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: studynameANY });
                    expect(createANYStudyRes.body.data.createStudy).toEqual({
                        id: createdStudyAny.id,
                        name: studynameANY,
                        description: 'test description',
                        type: studyType.ANY
                    });

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
                            permissions.specific_study.specific_study_data_management
                        ],
                        users: [authorisedUserProfile.id],
                        deleted: null
                    };
                    await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

                    authorisedUser = request.agent(app);
                    await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);
                });

                test('Upload file to SENSOR study (admin)', async () => {
                    /* test: upload file */
                    const res = await admin.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudy.id,
                                file: null,
                                description: JSON.stringify({ participantId: 'I7N3G6G', deviceId: 'MMM7N3G6G', startDate: 1593817200000, endDate: 1595286000000 }),
                                fileLength: 13,
                                hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));

                    /* setup: geting the created file Id */
                    const createdFile = await mongoClient.collection(config.database.collections.files_collection).findOne({ fileName: 'I7N3G6G-MMM7N3G6G-20200704-20200721.txt', studyId: createdStudy.id });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    const { uploadTime, ...uploadFile } = res.body.data.uploadFile;
                    expect(uploadTime).toBeDefined();
                    expect(uploadFile).toEqual({
                        id: createdFile.id,
                        fileName: 'I7N3G6G-MMM7N3G6G-20200704-20200721.txt',
                        studyId: createdStudy.id,
                        projectId: null,
                        fileSize: '13',
                        description: JSON.stringify({ participantId: 'I7N3G6G', deviceId: 'MMM7N3G6G', startDate: 1593817200000, endDate: 1595286000000 }),
                        uploadedBy: adminId,
                        hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                    });
                });

                test('Upload file to CLINICAL study (admin)', async () => {
                    /* test: upload file */
                    const res = await admin.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudyClinical.id,
                                file: null,
                                description: JSON.stringify({}),
                                fileLength: 13,
                                hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/prolific_test.txt'));

                    /* setup: geting the created file Id */
                    const createdFile = await mongoClient.collection(config.database.collections.files_collection).findOne({ fileName: 'prolific_test.txt', studyId: createdStudyClinical.id });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    const { uploadTime, ...uploadFile } = res.body.data.uploadFile;
                    expect(uploadTime).toBeDefined();
                    expect(uploadFile).toEqual({
                        id: createdFile.id,
                        fileName: 'prolific_test.txt',
                        studyId: createdStudyClinical.id,
                        projectId: null,
                        fileSize: '13',
                        description: JSON.stringify({}),
                        uploadedBy: adminId,
                        hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                    });
                });

                test('Upload file to study ANY (admin)', async () => {
                    /* test: upload file */
                    const res = await admin.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudyAny.id,
                                file: null,
                                description: JSON.stringify({}),
                                fileLength: 13,
                                hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/RandomFile.txt'));

                    /* setup: geting the created file Id */
                    const createdFile = await mongoClient.collection(config.database.collections.files_collection).findOne({ fileName: 'RandomFile.txt', studyId: createdStudyAny.id });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    const { uploadTime, ...uploadFile } = res.body.data.uploadFile;
                    expect(uploadTime).toBeDefined();
                    expect(uploadFile).toEqual({
                        id: createdFile.id,
                        fileName: 'RandomFile.txt',
                        studyId: createdStudyAny.id,
                        projectId: null,
                        fileSize: '13',
                        description: JSON.stringify({}),
                        uploadedBy: adminId,
                        hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                    });
                });

                test('Upload file to study (user with no privilege) (should fail)', async () => {
                    /* test: upload file */
                    const res = await user.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudy.id,
                                file: null,
                                description: JSON.stringify({ participantId: 'I7N3G6G', deviceId: 'MMM7N3G6G', startDate: 1593817200000, endDate: 1595286000000 }),
                                fileLength: 13,
                                hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));

                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                    expect(res.body.data.uploadFile).toEqual(null);
                });

                test('Upload file to study (user with privilege)', async () => {
                    /* test: upload file */
                    const res = await authorisedUser.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudy.id,
                                file: null,
                                description: JSON.stringify({ participantId: 'I7N3G6G', deviceId: 'MMM7N3G6G', startDate: 1593817200000, endDate: 1595286000000 }),
                                fileLength: 13,
                                hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));

                    /* setup: geting the created file Id */
                    const createdFile = await mongoClient.collection(config.database.collections.files_collection).findOne({ fileName: 'I7N3G6G-MMM7N3G6G-20200704-20200721.txt', studyId: createdStudy.id });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    const { uploadTime, ...uploadFile } = res.body.data.uploadFile;
                    expect(uploadTime).toBeDefined();
                    expect(uploadFile).toEqual({
                        id: createdFile.id,
                        fileName: 'I7N3G6G-MMM7N3G6G-20200704-20200721.txt',
                        studyId: createdStudy.id,
                        projectId: null,
                        fileSize: '13',
                        description: JSON.stringify({ participantId: 'I7N3G6G', deviceId: 'MMM7N3G6G', startDate: 1593817200000, endDate: 1595286000000 }),
                        uploadedBy: authorisedUserProfile.id,
                        hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                    });
                });

                test('Upload a empty file (admin)', async () => {
                    /* test: upload file */
                    const res = await admin.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudy.id,
                                file: null,
                                description: JSON.stringify({ participantId: 'IR6R4AR', deviceId: 'AX6VJH6F6', startDate: 1590966000000, endDate: 1593730800000 }),
                                fileLength: 0,
                                hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/IR6R4AR-AX6VJH6F6-20200601-20200703.txt'));

                    /* setup: geting the created file Id */
                    const createdFile = await mongoClient.collection(config.database.collections.files_collection).findOne({ fileName: 'IR6R4AR-AX6VJH6F6-20200601-20200703.txt', studyId: createdStudy.id });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    const { uploadTime, ...uploadFile } = res.body.data.uploadFile;
                    expect(uploadTime).toBeDefined();
                    expect(uploadFile).toEqual({
                        id: createdFile.id,
                        fileName: 'IR6R4AR-AX6VJH6F6-20200601-20200703.txt',
                        studyId: createdStudy.id,
                        projectId: null,
                        fileSize: '0',
                        description: JSON.stringify({ participantId: 'IR6R4AR', deviceId: 'AX6VJH6F6', startDate: 1590966000000, endDate: 1593730800000 }),
                        uploadedBy: adminId,
                        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
                    });
                });

                test('Upload a file with incorrect hash', async () => {
                    /* test: upload file */
                    const res = await admin.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudy.id,
                                file: null,
                                description: 'just a file 3.',
                                fileLength: 13,
                                hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a4'
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));

                    /* setup: geting the created file Id */
                    expect(res.status).toBe(200);

                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe('File hash not match');
                    expect(res.body.data.uploadFile).toEqual(null);
                });

                test('File size mismatch with actual read bytes', async () => {
                    /* test: upload file */
                    const res = await admin.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudy.id,
                                file: null,
                                description: JSON.stringify({ participantId: 'I7N3G6G', deviceId: 'MMM7N3G6G', startDate: 1593817200000, endDate: 1595286000000 }),
                                fileLength: 10
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));

                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe('File size mismatch');
                    expect(res.body.data.uploadFile).toEqual(null);
                });

                test('File description mismatch with file name', async () => {
                    /* test: upload file */
                    const res = await admin.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudy.id,
                                file: null,
                                description: JSON.stringify({ participantId: '27N3G6G', deviceId: 'MMM7N3G6G', startDate: 1593817200000, endDate: 1595286000000 }),
                                fileLength: 13
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));

                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe('File description is invalid');
                    expect(res.body.data.uploadFile).toEqual(null);
                });
            });

            describe('DOWNLOAD FILES', () => {
                /* note: a new study is created and a non-empty text file is uploaded before each test */
                let createdStudy;
                let createdFile;
                let authorisedUser;
                let authorisedUserProfile;

                beforeEach(async () => {
                    /* setup: create studies to upload file to */
                    const studyname = uuid();
                    const createStudyRes = await admin.post('/graphql').send({
                        query: print(CREATE_STUDY),
                        variables: { name: studyname, description: 'test description', type: studyType.SENSOR }
                    });
                    expect(createStudyRes.status).toBe(200);
                    expect(createStudyRes.body.errors).toBeUndefined();

                    /* setup: getting the created study Id */
                    createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: studyname });
                    expect(createStudyRes.body.data.createStudy).toEqual({
                        id: createdStudy.id,
                        name: studyname,
                        description: 'test description',
                        type: studyType.SENSOR
                    });

                    /* setup: upload file (would be better to upload not via app api but will do for now) */
                    await admin.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudy.id,
                                file: null,
                                description: JSON.stringify({ participantId: 'I7N3G6G', deviceId: 'MMM7N3G6G', startDate: 1593817200000, endDate: 1595286000000 }),
                                fileLength: 13,
                                hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));

                    /* setup: geting the created file Id */
                    createdFile = await mongoClient.collection(config.database.collections.files_collection).findOne({ fileName: 'I7N3G6G-MMM7N3G6G-20200704-20200721.txt', studyId: createdStudy.id });

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
                            permissions.specific_study.specific_study_data_management
                        ],
                        users: [authorisedUserProfile.id],
                        deleted: null
                    };
                    await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

                    authorisedUser = request.agent(app);
                    await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);
                });

                test('Download file from study (admin)', async () => {
                    const res = await admin.get(`/file/${createdFile.id}`);
                    expect(res.status).toBe(200);
                    expect(res.headers['content-type']).toBe('application/download');
                    expect(res.headers['content-disposition']).toBe('attachment; filename="I7N3G6G-MMM7N3G6G-20200704-20200721.txt"');
                    expect(res.text).toBe('just testing.');
                });

                test('Download file from study (user with privilege)', async () => {
                    const res = await authorisedUser.get(`/file/${createdFile.id}`);
                    expect(res.status).toBe(200);
                    expect(res.headers['content-type']).toBe('application/download');
                    expect(res.headers['content-disposition']).toBe('attachment; filename="I7N3G6G-MMM7N3G6G-20200704-20200721.txt"');
                    expect(res.text).toBe('just testing.');
                });

                test('Download file from study (not logged in)', async () => {
                    const loggedoutUser = request.agent(app);
                    const res = await loggedoutUser.get(`/file/${createdFile.id}`);
                    expect(res.status).toBe(403);
                    expect(res.body).toEqual({ error: 'Please log in.' });
                });

                test('Download file from study (user with no privilege) (should fail)', async () => {
                    const res = await user.get(`/file/${createdFile.id}`);
                    expect(res.status).toBe(404);
                    expect(res.body).toEqual({ error: 'File not found or you do not have the necessary permission.' });
                });

                test('Download an non-existent file from study (admin) (should fail)', async () => {
                    const res = await admin.get('/file/fakefileid');
                    expect(res.status).toBe(404);
                    expect(res.body).toEqual({ error: 'File not found or you do not have the necessary permission.' });
                });

                test('Download an non-existent file from study (not logged in)', async () => {
                    const loggedoutUser = request.agent(app);
                    const res = await loggedoutUser.get('/file/fakefileid');
                    expect(res.status).toBe(403);
                    expect(res.body).toEqual({ error: 'Please log in.' });
                });

                test('Download an non-existent file from study (user without privilege) (should fail)', async () => {
                    const res = await user.get('/file/fakefileid');
                    expect(res.status).toBe(404);
                    expect(res.body).toEqual({ error: 'File not found or you do not have the necessary permission.' });
                });

                test('Download an non-existent file from study (user with privilege) (should fail)', async () => {
                    const res = await authorisedUser.get('/file/fakefileid');
                    expect(res.status).toBe(404);
                    expect(res.body).toEqual({ error: 'File not found or you do not have the necessary permission.' });
                });
            });

            describe('DELETE FILES', () => {
                let createdStudy;
                let createdFile;
                let authorisedUser;
                let authorisedUserProfile;
                beforeEach(async () => {
                    /* setup: create a study to upload file to */
                    const studyname = uuid();
                    const createStudyRes = await admin.post('/graphql').send({
                        query: print(CREATE_STUDY),
                        variables: { name: studyname, description: 'test description', type: studyType.SENSOR }
                    });
                    expect(createStudyRes.status).toBe(200);
                    expect(createStudyRes.body.errors).toBeUndefined();

                    /* setup: getting the created study Id */
                    createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: studyname });
                    expect(createStudyRes.body.data.createStudy).toEqual({
                        id: createdStudy.id,
                        name: studyname,
                        description: 'test description',
                        type: studyType.SENSOR
                    });

                    /* setup: upload file (would be better to upload not via app api but will do for now) */
                    await admin.post('/graphql')
                        .field('operations', JSON.stringify({
                            query: print(UPLOAD_FILE),
                            variables: {
                                studyId: createdStudy.id,
                                file: null,
                                description: JSON.stringify({ participantId: 'I7N3G6G', deviceId: 'MMM7N3G6G', startDate: 1593817200000, endDate: 1595286000000 }),
                                fileLength: 13,
                                hash: '4ae25be36354ee0aec8dc8deac3f279d2e9d6415361da996cf57eb6142cfb1a2'
                            }
                        }))
                        .field('map', JSON.stringify({ 1: ['variables.file'] }))
                        .attach('1', path.join(__dirname, '../filesForTests/I7N3G6G-MMM7N3G6G-20200704-20200721.txt'));

                    /* setup: geting the created file Id */
                    createdFile = await mongoClient.collection(config.database.collections.files_collection).findOne({ fileName: 'I7N3G6G-MMM7N3G6G-20200704-20200721.txt', studyId: createdStudy.id, deleted: null });

                    /* before test: can download file */
                    const res = await admin.get(`/file/${createdFile.id}`);
                    if (res.status !== 200) {
                        console.log(chalk.red(JSON.stringify(res, null, 4)));
                    }
                    expect(res.status).toBe(200);
                    expect(res.headers['content-type']).toBe('application/download');
                    expect(res.headers['content-disposition']).toBe('attachment; filename="I7N3G6G-MMM7N3G6G-20200704-20200721.txt"');
                    expect(res.text).toBe('just testing.');

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
                            permissions.specific_study.specific_study_data_management
                        ],
                        users: [authorisedUserProfile.id],
                        deleted: null
                    };
                    await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

                    authorisedUser = request.agent(app);
                    await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);
                });

                test('Delete file from study (admin)', async () => {
                    const res = await admin.post('/graphql').send({
                        query: print(DELETE_FILE),
                        variables: { fileId: createdFile.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.deleteFile).toEqual({ successful: true });

                    const downloadFileRes = await admin.get(`/file/${createdFile.id}`);
                    expect(downloadFileRes.status).toBe(404);
                    expect(downloadFileRes.body).toEqual({ error: 'File not found or you do not have the necessary permission.' });
                });

                test('Delete file from study (user with privilege)', async () => {
                    const res = await authorisedUser.post('/graphql').send({
                        query: print(DELETE_FILE),
                        variables: { fileId: createdFile.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toBeUndefined();
                    expect(res.body.data.deleteFile).toEqual({ successful: true });

                    const downloadFileRes = await authorisedUser.get(`/file/${createdFile.id}`);
                    expect(downloadFileRes.status).toBe(404);
                    expect(downloadFileRes.body).toEqual({ error: 'File not found or you do not have the necessary permission.' });
                });

                test('Delete file from study (user with no privilege) (should fail)', async () => {
                    const res = await user.post('/graphql').send({
                        query: print(DELETE_FILE),
                        variables: { fileId: createdFile.id }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                    expect(res.body.data.deleteFile).toBe(null);

                    const downloadFileRes = await admin.get(`/file/${createdFile.id}`);
                    expect(downloadFileRes.status).toBe(200);
                    expect(downloadFileRes.headers['content-type']).toBe('application/download');
                    expect(downloadFileRes.headers['content-disposition']).toBe('attachment; filename="I7N3G6G-MMM7N3G6G-20200704-20200721.txt"');
                    expect(downloadFileRes.text).toBe('just testing.');
                });

                test('Delete an non-existent file from study (admin)', async () => {
                    const res = await admin.post('/graphql').send({
                        query: print(DELETE_FILE),
                        variables: { fileId: 'nosuchfile' }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                    expect(res.body.data.deleteFile).toBe(null);
                });

                test('Delete an non-existent file from study (user with privilege)', async () => {
                    const res = await authorisedUser.post('/graphql').send({
                        query: print(DELETE_FILE),
                        variables: { fileId: 'nosuchfile' }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                    expect(res.body.data.deleteFile).toBe(null);
                });

                test('Delete an non-existent file from study (user with no privilege)', async () => {
                    const res = await user.post('/graphql').send({
                        query: print(DELETE_FILE),
                        variables: { fileId: 'nosuchfile' }
                    });
                    expect(res.status).toBe(200);
                    expect(res.body.errors).toHaveLength(1);
                    expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                    expect(res.body.data.deleteFile).toBe(null);
                });
            });
        });

        // describe('FILE PERMISSION FOR PROJECTS', () => {
        //     test('1 + 1', () => {
        //         expect(2).toBe(3);
        //     });
        // });
    });
} else
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });

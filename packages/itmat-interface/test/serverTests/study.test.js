const request = require('supertest');
const { print } = require('graphql');
const { connectAdmin, connectUser, connectAgent } = require('./_loginHelper');
const { db } = require('../../src/database/database');
const { Router } = require('../../src/server/router');
const { errorCodes } = require('../../src/graphql/errors');
const { MongoClient } = require('mongodb');
const itmatCommons = require('itmat-commons');
const { WHO_AM_I, CREATE_PROJECT, CREATE_STUDY, DELETE_STUDY } = itmatCommons.GQLRequests;
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
            const res = await admin.post('/graphql').send({
                query: print(CREATE_STUDY),
                variables: { name: 'new_study_1' }
            });
            expect(res.status).toBe(200);
            expect(res.body.data.errors).toBeUndefined();

            const createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: 'new_study_1' });
            expect(res.body.data.createStudy).toEqual({
                id: createdStudy.id,
                name: 'new_study_1'
            });

            const resWhoAmI = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
            expect(resWhoAmI.status).toBe(200);
            expect(resWhoAmI.body.data.errors).toBeUndefined();
            expect(resWhoAmI.body.data.whoAmI).toEqual({
                username: 'admin', 
                type: Models.UserModels.userTypes.ADMIN, 
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
                        name: 'new_study_1'
                    }]
                }
            });
        });

        test('Create study that violate unique name constraint (admin)', async () => {
            const newStudy = {
                id: 'fakeNewStudyId2',
                name: 'new_study_2',
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(newStudy);

            const res = await admin.post('/graphql').send({
                query: print(CREATE_STUDY),
                variables: { name: 'new_study_2' }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe('E11000 duplicate key error dup key: { : \"new_study_2\", : null }');
            expect(res.body.data.createStudy).toBe(null);
        });

        test('Create study (user) (should fail)', async () => {
            const res = await user.post('/graphql').send({
                query: print(CREATE_STUDY),
                variables: { name: 'new_study_3' }
            });
            expect(res.status).toBe(200);
            expect(res.body.data.createStudy).toBe(null);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);

            const createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: 'new_study_3' });
            expect(createdStudy).toBe(null);
        });

        test('Delete study (admin)', async () => {
            const newStudy = {
                id: 'fakeNewStudyId4',
                name: 'new_study_4',
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
                type: Models.UserModels.userTypes.ADMIN, 
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
                        name: 'new_study_4'
                    }]
                }
            });

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
        });

        test('Delete study that has been deleted (admin)', async () => {
            const newStudy = {
                id: 'fakeNewStudyId5',
                name: 'new_study_5',
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: new Date().valueOf(),
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(newStudy);

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
            expect(1).toBe(2); // // error not caught. study delete is multiple steps
        });

        test('Delete study that never existed (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(DELETE_STUDY),
                variables: { studyId: 'I_never_existed' }
            });
            expect(res.status).toBe(200);
            expect(res.body.data.deleteStudy).toEqual({
                id: 'I_never_existed',
                successful: true
            });
            expect(1).toBe(2); // error not caught. study delete is multiple steps
        });

        test('Delete study (user) (should fail)', async () => {
            const newStudy = {
                id: 'fakeNewStudyId6',
                name: 'new_study_6',
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(newStudy);

            const res = await user.post('/graphql').send({
                query: print(DELETE_STUDY),
                variables: { studyId: 'new_study_6' }
            });
            expect(res.status).toBe(200);
            expect(res.body.data.deleteStudy).toBe(null);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);

            /* confirms that the created study is still alive */
            const createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: 'new_study_6' });
            expect(createdStudy.deleted).toBe(null);
        });
    });
    
    describe('MANIPULATING PROJECTS EXISTENCE', () => {
        let setupStudy;
        beforeAll(async () => {
            setupStudy = {
                id: 'setupStudyId',
                name: 'setupStudy',
                createdBy: 'admin',
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(setupStudy);
        });

        test('Create project (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_PROJECT),
                variables: {
                    studyId: setupStudy.id,
                    projectName: 'new_project_1'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();

            const createdProject = await mongoClient.collection(config.database.collections.projects_collection).findOne({ name: 'new_project_1'});

            expect(res.body.data.createProject).toEqual({
                id: createdProject.id,
                studyId: setupStudy.id,
                name: 'new_project_1',
                approvedFields: {}
            });
            expect(1).toBe(2);  // patient mapping not tested
        });

        test.only('Create project (user with no privilege) (should fail)', async () => {
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

        test.only('Create project (user with privilege)', async () => {
            const newUser = {
                username : 'new_user_1', 
                type: 'STANDARD', 
                realName: 'real_name_1', 
                password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi', 
                createdBy: 'admin', 
                email: 'new1@user.io', 
                description: 'I am a new user.',
                emailNotificationsActivated: true, 
                organisation:  'DSI',
                deleted: null, 
                id: 'new_user_id_1'
            };
            await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

            const newRole = {
                id: 'role001',
                projectId: null,
                studyId: setupStudy.id,
                name: 'Study PI',
                permissions: [
                    permissions.specific_study.specific_study_projects_management
                ],
                users: [newUser.id],
                deleted: null 
            };
            await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

            const createdUser = request.agent(app);
            await connectAgent(createdUser, 'new_user_1', 'admin');

            const res = await createdUser.post('/graphql').send({
                query: print(CREATE_PROJECT),
                variables: {
                    studyId: setupStudy.id,
                    projectName: 'new_project_7'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();

            const createdProject = await mongoClient.collection(config.database.collections.projects_collection).findOne({ name: 'new_project_7'});
            expect(res.body.data.createProject).toEqual({
                id: createdProject.id,
                studyId: setupStudy.id,
                name: 'new_project_7',
                approvedFields: {}
            });
        });

        // test('edit project approved fields with incorrect field (as string) (user)',  () => user
        //     .post('/graphql')
        //     .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 'non-existent-field' } } })
        //     .then(res => {
        //         expect(res.status).toBe(200);
        //         expect(res.body.data.editProjectApprovedFields).toBeNull();
        //         expect(res.body.errors[0].message).toBe('Unauthorised.');
        //         expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
        //         return true;
        // }));

        // test('edit project approved fields with incorrect field (doesnt exist) (user)',  () => user
        //     .post('/graphql')
        //     .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 9999999999 } } })
        //     .then(res => {
        //         expect(res.status).toBe(200);
        //         expect(res.body.data.editProjectApprovedFields).toBeNull();
        //         expect(res.body.errors[0].message).toBe('Unauthorised.');
        //         expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
        //         return true;
        // }));

        // test('edit project approved fields with correct field number (user)',  () => user
        //     .post('/graphql')
        //     .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 32 } } })
        //     .then(res => {
        //         expect(res.status).toBe(200);
        //         expect(res.body.data.editProjectApprovedFields).toBeNull();
        //         expect(res.body.errors[0].message).toBe('Unauthorised.');
        //         expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
        //         return true;
        // }));

        // test('edit project approved fields with incorrect field (as string) (admin)',  () => admin
        //     .post('/graphql')
        //     .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 'non-existent-field' } } })
        //     .then(res => {
        //         expect(res.status).toBe(200);
        //         expect(res.body.data.editProjectApprovedFields).toBeNull();
        //         expect(res.body.errors[0].message).toBe('Unauthorised.');
        //         expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
        //         return true;
        // }));

        // test('edit project approved fields with incorrect field (doesnt exist) (admin)',  () => admin
        //     .post('/graphql')
        //     .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 99999999999 } } })
        //     .then(res => {
        //         expect(res.status).toBe(200);
        //         expect(res.body.data.editProjectApprovedFields).toBeNull();
        //         expect(res.body.errors[0].message).toBe('Unauthorised.');
        //         expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
        //         return true;
        // }));

        // test('edit project approved fields with correct field number (admin)',  () => admin
        //     .post('/graphql')
        //     .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 32 } } })
        //     .then(res => {
        //         expect(res.status).toBe(200);
        //         expect(res.body.data.editProjectApprovedFields).toBeNull();
        //         expect(res.body.errors[0].message).toBe('Unauthorised.');
        //         expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
        //         return true;
        // }));





    });
});
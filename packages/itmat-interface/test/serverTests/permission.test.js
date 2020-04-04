const request = require('supertest');
const { print } = require('graphql');
const { connectAdmin, connectUser, connectAgent } = require('./_loginHelper');
const { db } = require('../../src/database/database');
const { Router } = require('../../src/server/router');
const { errorCodes } = require('../../src/graphql/errors');
const { MongoClient } = require('mongodb');
const itmatCommons = require('itmat-commons');
const { WHO_AM_I, ADD_NEW_ROLE, CREATE_PROJECT, CREATE_STUDY, DELETE_STUDY } = itmatCommons.GQLRequests;
const { MongoMemoryServer } = require('mongodb-memory-server');
const setupDatabase = require('itmat-utils/src/databaseSetup/collectionsAndIndexes');
const config = require('../../config/config.sample.json');
const { Models, permissions } = itmatCommons;
const uuid = require('uuid/v4');

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

describe('ROLE API', () => {
    let adminId;
    let userId;

    beforeAll(async () => {
        /* setup: first retrieve the generated user id */
        const result = await mongoClient.collection(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
        adminId = result.filter(e => e.username === 'admin')[0].id;
        userId = result.filter(e => e.username === 'standardUser')[0].id;
    });

    describe('ADDING ROLE', () => {
        let setupStudy;
        let setupProject;
        let authorisedUser;
        let authorisedUserProfile;
        beforeEach(async () => {
            const studyName = uuid();
            setupStudy = {
                id: `id_${studyName}`,
                name: studyName,
                createdBy: adminId,
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(setupStudy);

            const projectName = uuid();
            setupProject = {
                id: `id_${projectName}`,
                studyId: setupStudy.id,
                createdBy: adminId,
                patientMapping: {},
                name: projectName,
                approvedFields: {}, 
                approvedFiles: [],
                lastModified: 20000002,
                deleted: null
            };
            await mongoClient.collection(config.database.collections.projects_collection).insertOne(setupProject);

            /* setup: creating a privileged user (not yet added roles) */
            const username = uuid();
            authorisedUserProfile = {
                username, 
                type: 'STANDARD', 
                realName: `${username}_realname`, 
                password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi', 
                createdBy: 'admin', 
                email: `${username}@user.io`, 
                description: 'I am a new user.',
                emailNotificationsActivated: true, 
                organisation:  'DSI',
                deleted: null, 
                id: `new_user_id_${username}`
            };
            await mongoClient.collection(config.database.collections.users_collection).insertOne(authorisedUserProfile);

            authorisedUser = request.agent(app);
            await connectAgent(authorisedUser, username, 'admin')

        });

        test('Creating a new role for study (admin)', async () => {
            const roleName = uuid();
            const res = await admin.post('/graphql').send({
                query: print(ADD_NEW_ROLE),
                variables: {
                    roleName,
                    studyId: setupStudy.id,
                    projectId: null
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();

            const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
            expect(createdRole).toEqual({
                _id: createdRole._id,
                id: createdRole.id,
                projectId: null,
                studyId: setupStudy.id,
                name: roleName,
                permissions: [],
                createdBy: adminId,
                users: [],
                deleted: null
            });
            expect(res.body.data.addRoleToStudyOrProject).toEqual({
                id: createdRole.id,
                name: roleName,
                permissions: [],
                studyId: setupStudy.id,
                projectId: null,
                users: []
            });

            /* cleanup */
            await mongoClient.collection(config.database.collections.roles_collection).findOneAndUpdate({ name: roleName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        });

        test('Creating a new role for study (user without privilege) (should fail)', async () => {
            const roleName = uuid();
            const res = await user.post('/graphql').send({
                query: print(ADD_NEW_ROLE),
                variables: {
                    roleName,
                    studyId: setupStudy.id,
                    projectId: null
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            expect(res.body.data.addRoleToStudyOrProject).toEqual(null);

            const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
            expect(createdRole).toBe(null);
        });

        test('Creating a new role for study (user with privilege)', async () => {
            /* setup: adding privilege to authorised user */
            const roleId = uuid();
            const newRole = {
                id: roleId,
                projectId: null,
                studyId: setupStudy.id,
                name: `${roleId}_rolename`,
                permissions: [
                    permissions.specific_study.specific_study_role_management
                ],
                users: [authorisedUserProfile.id],
                deleted: null
            };
            await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

            /* test */
            const roleName = uuid();
            const res = await authorisedUser.post('/graphql').send({
                query: print(ADD_NEW_ROLE),
                variables: {
                    roleName,
                    studyId: setupStudy.id,
                    projectId: null
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();

            const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
            expect(createdRole).toEqual({
                _id: createdRole._id,
                id: createdRole.id,
                projectId: null,
                studyId: setupStudy.id,
                name: roleName,
                permissions: [],
                createdBy: authorisedUserProfile.id,
                users: [],
                deleted: null
            });
            expect(res.body.data.addRoleToStudyOrProject).toEqual({
                id: createdRole.id,
                name: roleName,
                permissions: [],
                studyId: setupStudy.id,
                projectId: null,
                users: []
            });

            /* cleanup */
            await mongoClient.collection(config.database.collections.roles_collection).findOneAndUpdate({ name: roleName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        });

        test('Creating a new role for project (admin)', async () => {
            const roleName = uuid();
            const res = await admin.post('/graphql').send({
                query: print(ADD_NEW_ROLE),
                variables: {
                    roleName,
                    studyId: setupStudy.id,
                    projectId: setupProject.id 
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();

            const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
            expect(createdRole).toEqual({
                _id: createdRole._id,
                id: createdRole.id,
                projectId: setupProject.id,
                studyId: setupStudy.id,
                name: roleName,
                permissions: [],
                createdBy: adminId,
                users: [],
                deleted: null
            });
            expect(res.body.data.addRoleToStudyOrProject).toEqual({
                id: createdRole.id,
                name: roleName,
                permissions: [],
                studyId: setupStudy.id,
                projectId: setupProject.id,
                users: []
            });

            /* cleanup */
            await mongoClient.collection(config.database.collections.roles_collection).findOneAndUpdate({ name: roleName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        });

        test('Creating a new role for project (user with privilege for another project in the same study) (should fail)', async () => {
            /* setup: creating another project */
            const anotherProjectName = uuid();
            const anotherSetupProject = {
                id: `id_${anotherProjectName}`,
                studyId: setupStudy.id,
                createdBy: adminId,
                patientMapping: {},
                name: anotherProjectName,
                approvedFields: {}, 
                approvedFiles: [],
                lastModified: 20000002,
                deleted: null
            };
            await mongoClient.collection(config.database.collections.projects_collection).insertOne(anotherSetupProject);

            /* setup: giving authorised user privilege */
            const roleId = uuid();
            const newRole = {
                id: roleId,
                projectId: anotherSetupProject.id,
                studyId: setupStudy.id,
                name: `${roleId}_rolename`,
                permissions: [
                    permissions.specific_project.specific_project_role_management
                ],
                users: [authorisedUserProfile.id],
                deleted: null
            };
            await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

            /* test */
            const roleName = uuid();
            const res = await authorisedUser.post('/graphql').send({
                query: print(ADD_NEW_ROLE),
                variables: {
                    roleName,
                    studyId: setupStudy.id,
                    projectId: setupProject.id 
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            expect(res.body.data.addRoleToStudyOrProject).toEqual(null);

            const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
            expect(createdRole).toBe(null);
        });

        test('Creating a new role for project (user with privilege for this project)', async () => {
            /* setup: giving authorised user privilege */
            const roleId = uuid();
            const newRole = {
                id: roleId,
                projectId: setupProject.id,
                studyId: setupStudy.id,
                name: `${roleId}_rolename`,
                permissions: [
                    permissions.specific_project.specific_project_role_management
                ],
                users: [authorisedUserProfile.id],
                deleted: null
            };
            await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

            /* test */
            const roleName = uuid();
            const res = await authorisedUser.post('/graphql').send({
                query: print(ADD_NEW_ROLE),
                variables: {
                    roleName,
                    studyId: setupStudy.id,
                    projectId: setupProject.id 
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();

            const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
            expect(createdRole).toEqual({
                _id: createdRole._id,
                id: createdRole.id,
                projectId: setupProject.id,
                studyId: setupStudy.id,
                name: roleName,
                permissions: [],
                createdBy: authorisedUserProfile.id,
                users: [],
                deleted: null
            });
            expect(res.body.data.addRoleToStudyOrProject).toEqual({
                id: createdRole.id,
                name: roleName,
                permissions: [],
                studyId: setupStudy.id,
                projectId: setupProject.id,
                users: []
            });

            /* cleanup */
            await mongoClient.collection(config.database.collections.roles_collection).findOneAndUpdate({ name: roleName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        });

        test('Creating a new role for project (user with privilege for the study)', async () => {
            /* setup: giving authorised user privilege */
            const roleId = uuid();
            const newRole = {
                id: roleId,
                projectId: null,
                studyId: setupStudy.id,
                name: `${roleId}_rolename`,
                permissions: [
                    permissions.specific_study.specific_study_role_management
                ],
                users: [authorisedUserProfile.id],
                deleted: null
            };
            await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

            /* test */
            const roleName = uuid();
            const res = await authorisedUser.post('/graphql').send({
                query: print(ADD_NEW_ROLE),
                variables: {
                    roleName,
                    studyId: setupStudy.id,
                    projectId: setupProject.id 
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();

            const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
            expect(createdRole).toEqual({
                _id: createdRole._id,
                id: createdRole.id,
                projectId: setupProject.id,
                studyId: setupStudy.id,
                name: roleName,
                permissions: [],
                createdBy: authorisedUserProfile.id,
                users: [],
                deleted: null
            });
            expect(res.body.data.addRoleToStudyOrProject).toEqual({
                id: createdRole.id,
                name: roleName,
                permissions: [],
                studyId: setupStudy.id,
                projectId: setupProject.id,
                users: []
            });

            /* cleanup */
            await mongoClient.collection(config.database.collections.roles_collection).findOneAndUpdate({ name: roleName, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        });

        test('Creating a new role for project (user without privilege) (should fail)', async () => {
            const roleName = uuid();
            const res = await user.post('/graphql').send({
                query: print(ADD_NEW_ROLE),
                variables: {
                    roleName,
                    studyId: setupStudy.id,
                    projectId: setupProject.id 
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            expect(res.body.data.addRoleToStudyOrProject).toEqual(null);

            const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
            expect(createdRole).toBe(null);
        });
    });

    describe('EDITING ROLE', () => {
        let setupStudy;
        let setupProject;
        let setupRole;
        let authorisedUser;
        let authorisedUserProfile;
        beforeEach(async () => {
            const studyName = uuid();
            setupStudy = {
                id: `id_${studyName}`,
                name: studyName,
                createdBy: adminId,
                lastModified: 200000002,
                deleted: null,
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(setupStudy);

            const projectName = uuid();
            setupProject = {
                id: `id_${projectName}`,
                studyId: setupStudy.id,
                createdBy: adminId,
                patientMapping: {},
                name: projectName,
                approvedFields: {}, 
                approvedFiles: [],
                lastModified: 20000002,
                deleted: null
            };
            await mongoClient.collection(config.database.collections.projects_collection).insertOne(setupProject);

            /* setup: creating a privileged user (not yet added roles) */
            const username = uuid();
            authorisedUserProfile = {
                username, 
                type: 'STANDARD', 
                realName: `${username}_realname`, 
                password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi', 
                createdBy: 'admin', 
                email: `${username}@user.io`, 
                description: 'I am a new user.',
                emailNotificationsActivated: true, 
                organisation:  'DSI',
                deleted: null, 
                id: `new_user_id_${username}`
            };
            await mongoClient.collection(config.database.collections.users_collection).insertOne(authorisedUserProfile);

            authorisedUser = request.agent(app);
            await connectAgent(authorisedUser, username, 'admin')
        });

    });

    describe('DELETING ROLE', () => {

    });
});
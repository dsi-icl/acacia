import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { errorCodes } from '../../src/graphql/errors';
import { MongoClient } from 'mongodb';
import * as itmatCommons from 'itmat-commons';
const { GET_USERS, EDIT_ROLE, CREATE_USER, ADD_NEW_ROLE, WHO_AM_I, CREATE_PROJECT, CREATE_STUDY, DELETE_STUDY, DELETE_PROJECT } = itmatCommons.GQLRequests;
const { userTypes } = itmatCommons.Models.UserModels;
import { MongoMemoryServer } from 'mongodb-memory-server';
import setupDatabase from 'itmat-utils/src/databaseSetup/collectionsAndIndexes';
import config from '../../config/config.sample.json';
const { Models, permissions } = itmatCommons;
import { v4 as uuid } from 'uuid';
import { GET_STUDY, GET_PROJECT } from 'itmat-commons/src/graphql';

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
        let setupProject;
        beforeEach(async () => {
            /* setup: creating a study */
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

            /* setup: creating a project */
            const projectName = uuid();
            setupProject = {
                id: `id_${projectName}`,
                studyId: setupStudy.id,
                createdBy: 'admin',
                name: projectName,
                patientMapping: { 'patient001': 'patientA' },
                approvedFields: [],
                approvedFiles: [],
                lastModified: 20000002,
                deleted: null
            };
            await mongoClient.collection(config.database.collections.projects_collection).insertOne(setupProject);
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
                organisation:  'DSI',
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
            await connectAgent(authorisedUser, username, 'admin')

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
            await connectAgent(authorisedUser, username, 'admin')

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
        let createdProject;
        let createdStudy;
        let createdRole_study; // tslint:disable-line
        let createdRole_project;// tslint:disable-line
        let createdUserAuthorised;
        beforeAll(async () => {
            /*** setup: create a setup study ***/
            /* 1. create study */
            {
                const studyName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_STUDY),
                    variables: { name: studyName }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                createdStudy = await mongoClient.collection(config.database.collections.studies_collection).findOne({ name: studyName });
                expect(res.body.data.createStudy).toEqual({
                    id: createdStudy.id,
                    name: studyName
                });
            }

            /* 2. create projects for the study */
            {
                const projectName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_PROJECT),
                    variables: {
                        studyId: createdStudy.id,
                        projectName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                createdProject = await mongoClient.collection(config.database.collections.projects_collection).findOne({ name: projectName });
                expect(res.body.data.createProject).toEqual({
                    id: createdProject.id,
                    studyId: createdStudy.id,
                    name: projectName,
                    approvedFields: {},
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

                createdRole_study = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
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
                createdRole_project = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
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

            /* 5. create an authorised user (no role yet) */
            {
                const username = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_USER),
                    variables: {
                        username,
                        password: 'admin',
                        realName: `${username}_realname`,
                        description: 'setupUser',
                        organisation: 'DSI',
                        emailNotificationsActivated: true,
                        email: `${username}@user.io`,
                        type: userTypes.STANDARD
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                createdUserAuthorised = await mongoClient.collection(config.database.collections.users_collection).findOne({ username });
                expect(res.body.data.createUser).toEqual({
                    id: createdUserAuthorised.id,
                    username,
                    type: userTypes.STANDARD,
                    realName: `${username}_realname`,
                    description: 'setupUser',
                    organisation: 'DSI',
                    email: `${username}@user.io`,
                    createdBy: 'admin',
                    access: {
                        id: `user_access_obj_user_id_${createdUserAuthorised.id}`,
                        projects: [],
                        studies: []
                    }
                });
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
                        organisation: 'DSI',
                        realName: createdUserAuthorised.realName
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
                    realName: `${createdUserAuthorised.username}_realname`,
                    organisation: 'DSI',
                    createdBy: 'admin',
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
        });

        afterAll(async () => {
            /* delete study */
            /* check projects and roles are also deleted */

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

        test('Get study (admin)' , async () => {
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
                            permissions: [],
                            projectId: null,
                            studyId: createdStudy.id,
                            users: []
                        }
                    ],
                    files: [],
                    numOfSubjects: 0,
                    currentDataVersion: null,
                    dataVersions: []
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
                    approvedFields: {},
                    approvedFiles: [],
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
                                organisation: 'DSI',
                                realName: createdUserAuthorised.realName,
                                username: createdUserAuthorised.username
                            }]
                        }
                    ],
                    iCanEdit: true,
                    fields: {},
                    files: []
                });
            }
        });

        test('Get study (user without privilege)' , async () => {
            const res = await user.post('/graphql').send({
                query: print(GET_STUDY),
                variables: { studyId: createdStudy.id }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            expect(res.body.data.getStudy).toBe(null);
        });

        test('Get study (user with privilege)' , async () => {
            const authorisedUser = request.agent(app);
            await connectAgent(authorisedUser, createdUserAuthorised.username, 'admin')
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
                    variables: { projectId: createdProject.id, admin: true }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.getProject).toEqual({
                    id: createdProject.id,
                    studyId: createdStudy.id,
                    name: createdProject.name,
                    approvedFields: {},
                    approvedFiles: [],
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
                                organisation: 'DSI',
                                realName: createdUserAuthorised.realName,
                                username: createdUserAuthorised.username
                            }]
                        }
                    ],
                    iCanEdit: true,
                    fields: {},
                    files: []
                });
            }
        });
    });

    describe('CURATION MOCK', () => {
        /**
         * patientMapping
         * getStudyFields
         * project fields
         * editProjectApprovedFields
         */
    });
});
import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { errorCodes } from '../../src/graphql/errors';
import { MongoClient } from 'mongodb';
import * as itmatCommons from 'itmat-commons';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from 'itmat-setup';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
const { ADD_NEW_ROLE, EDIT_ROLE, REMOVE_ROLE } = itmatCommons.GQLRequests;
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

describe('ROLE API', () => {
    let adminId: string;

    beforeAll(async () => {
        /* setup: first retrieve the generated user id */
        const result = await mongoClient.collection(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
        adminId = result.filter(e => e.username === 'admin')[0].id;
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
                otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                email: `${username}@example.com`,
                description: 'I am a new user.',
                emailNotificationsActivated: true,
                organisation: 'DSI',
                deleted: null,
                id: `new_user_id_${username}`
            };
            await mongoClient.collection(config.database.collections.users_collection).insertOne(authorisedUserProfile);

            authorisedUser = request.agent(app);
            await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);
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
                    permissions.dataset_specific.roles.create_dataset_roles
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
                    permissions.project_specific.roles.create_project_roles
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
                    permissions.project_specific.roles.create_project_roles
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

        test('Creating a new role for project (user with privilege for the study) (should fail)', async () => {
            /* setup: giving authorised user privilege */
            const roleId = uuid();
            const newRole = {
                id: roleId,
                projectId: setupProject.id,
                studyId: setupStudy.id,
                name: `${roleId}_rolename`,
                permissions: [
                    permissions.dataset_specific.roles.create_dataset_roles
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
        describe('EDIT STUDY ROLE', () => {
            let setupStudy;
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

                /* setup: creating a privileged user (not yet added roles) */
                const username = uuid();
                authorisedUserProfile = {
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

                authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

                /* setup: giving authorised user privilege */
                const roleId = [uuid(), uuid()];
                const authorisedUserRole = {
                    id: roleId[0],
                    projectId: null,
                    studyId: setupStudy.id,
                    name: `${roleId[0]}_rolename`,
                    permissions: [
                        permissions.dataset_specific.roles.edit_dataset_role_users,
                        permissions.dataset_specific.roles.edit_dataset_role_permissions,
                        permissions.dataset_specific.roles.edit_dataset_role_name
                    ],
                    createdBy: adminId,
                    users: [authorisedUserProfile.id],
                    deleted: null
                };

                setupRole = {
                    id: roleId[1],
                    projectId: null,
                    studyId: setupStudy.id,
                    name: `${roleId[1]}_rolename`,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                };
                await mongoClient.collection(config.database.collections.roles_collection).insertMany([setupRole, authorisedUserRole]);
            });

            test('Edit a non-existent role (admin)', async () => {
                const newRoleName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: 'fake role id',
                        name: newRoleName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Edit a non-existent role (user)', async () => {
                const newRoleName = uuid();
                const res = await user.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: 'fake role id',
                        name: newRoleName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Change role name (admin)', async () => {
                const newRoleName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        name: newRoleName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: newRoleName,
                    studyId: setupStudy.id,
                    projectId: null,
                    permissions: [],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: newRoleName,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Change role name (privileged user)', async () => {
                const newRoleName = uuid();
                const res = await authorisedUser.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        name: newRoleName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: newRoleName,
                    studyId: setupStudy.id,
                    projectId: null,
                    permissions: [],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: newRoleName,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Change role name (user without privilege) (should fail)', async () => {
                const newRoleName = uuid();
                const oldName = setupRole.name;
                const res = await user.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        name: newRoleName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: oldName,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Add a non-existent user to role (admin)', async () => {
                /* setup: confirm that role has no user yet */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOne({
                    id: setupRole.id,
                    deleted: null
                });
                expect(role).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        userChanges: {
                            add: ['Iamafakeuser'],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_MALFORMED_INPUT);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Add user to role (admin)', async () => {
                /* setup: create a user to be added to role */
                const newUsername = uuid();
                const newUser = {
                    username: newUsername,
                    type: 'STANDARD',
                    realName: `${newUsername}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${newUsername}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `new_user_id_${newUsername}`
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        userChanges: {
                            add: [newUser.id],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupRole.studyId,
                    projectId: null,
                    permissions: [],
                    users: [{
                        id: newUser.id,
                        organisation: newUser.organisation,
                        realName: newUser.realName
                    }]
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [newUser.id],
                    deleted: null
                });
            });

            test('Add user to role (privileged user)', async () => {
                /* setup: create a user to be added to role */
                const newUsername = uuid();
                const newUser = {
                    username: newUsername,
                    type: 'STANDARD',
                    realName: `${newUsername}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${newUsername}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `new_user_id_${newUsername}`
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

                /* test */
                const res = await authorisedUser.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        userChanges: {
                            add: [newUser.id],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupRole.studyId,
                    projectId: null,
                    permissions: [],
                    users: [{
                        id: newUser.id,
                        organisation: newUser.organisation,
                        realName: newUser.realName
                    }]
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [newUser.id],
                    deleted: null
                });
            });

            test('Add user to role (user without privilege) (should fail)', async () => {
                /* setup: create a user to be added to role */
                const newUsername = uuid();
                const newUser = {
                    username: newUsername,
                    type: 'STANDARD',
                    realName: `${newUsername}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${newUsername}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `new_user_id_${newUsername}`
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

                /* test */
                const res = await user.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        userChanges: {
                            add: [newUser.id],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Remove user from role (admin)', async () => {
                /* setup: create a user to be removed from role */
                const newUsername = uuid();
                const newUser = {
                    username: newUsername,
                    type: 'STANDARD',
                    realName: `${newUsername}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${newUsername}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `new_user_id_${newUsername}`
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);
                const updatedRole = await mongoClient.collection(config.database.collections.roles_collection).findOneAndUpdate({
                    id: setupRole.id,
                    deleted: null
                }, {
                    $push: {
                        users: newUser.id
                    }
                }, { returnOriginal: false });
                expect(updatedRole.value.users).toEqual([newUser.id]);

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        userChanges: {
                            add: [],
                            remove: [newUser.id]
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupRole.studyId,
                    projectId: null,
                    permissions: [],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Add permission to role (admin)', async () => {
                /* setup: confirm that role has no permissions yet */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOne({
                    id: setupRole.id,
                    deleted: null
                });
                expect(role).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        permissionChanges: {
                            add: [
                                permissions.dataset_specific.projects.create_new_projects,
                                permissions.dataset_specific.view_dataset
                            ],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupRole.studyId,
                    projectId: null,
                    permissions: [
                        permissions.dataset_specific.projects.create_new_projects,
                        permissions.dataset_specific.view_dataset
                    ],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [
                        permissions.dataset_specific.projects.create_new_projects,
                        permissions.dataset_specific.view_dataset
                    ],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Add a duplicated permission to role (admin)', async () => {
                /* setup: confirm that role has one permissions yet */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOneAndUpdate({
                    id: setupRole.id,
                    deleted: null
                }, { $push: { permissions: permissions.dataset_specific.view_dataset } }, { returnOriginal: false });
                expect(role.value).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [ permissions.dataset_specific.view_dataset ],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        permissionChanges: {
                            add: [
                                permissions.dataset_specific.view_dataset
                            ],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupRole.studyId,
                    projectId: null,
                    permissions: [
                        permissions.dataset_specific.view_dataset
                    ],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [
                        permissions.dataset_specific.view_dataset
                    ],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Add two of the same permissions to role (admin)', async () => {
                /* setup: confirm that role has no permissions yet */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOne({
                    id: setupRole.id,
                    deleted: null
                });
                expect(role).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        permissionChanges: {
                            add: [
                                permissions.dataset_specific.view_dataset,
                                permissions.dataset_specific.view_dataset
                            ],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupRole.studyId,
                    projectId: null,
                    permissions: [
                        permissions.dataset_specific.view_dataset
                    ],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [
                        permissions.dataset_specific.view_dataset
                    ],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Adding a non-sense permission to role (admin) (should fail)', async () => {
                /* setup: confirm that role has no permissions yet */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOne({
                    id: setupRole.id,
                    deleted: null
                });
                expect(role).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        permissionChanges: {
                            add: [
                                'I am a fake permission!'
                            ],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_MALFORMED_INPUT);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Adding a project permission to study role (admin) (should fail)', async () => {
                /* setup: confirm that role has no permissions yet */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOne({
                    id: setupRole.id,
                    deleted: null
                });
                expect(role).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        permissionChanges: {
                            add: [
                                permissions.project_specific.roles.edit_project_role_permissions
                            ],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_MALFORMED_INPUT);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Remove permission from role (admin)', async () => {
                /* setup: confirm that role has one permissions */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOneAndUpdate({
                    id: setupRole.id,
                    deleted: null
                }, { $push: { permissions: permissions.dataset_specific.view_dataset } }, { returnOriginal: false });
                expect(role.value).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [permissions.dataset_specific.view_dataset],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        permissionChanges: {
                            add: [],
                            remove: [
                                permissions.dataset_specific.view_dataset
                            ]
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupRole.studyId,
                    projectId: null,
                    permissions: [],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Remove permission which is not added from role (admin)', async () => {
                /* setup: confirm that role has no permissions yet */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOne({
                    id: setupRole.id,
                    deleted: null
                });
                expect(role).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        permissionChanges: {
                            add: [],
                            remove: [
                                permissions.dataset_specific.view_dataset
                            ]
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupRole.studyId,
                    projectId: null,
                    permissions: [],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Combination of edits (admin)', async () => {
                /* setup: create a user to be removed from role */
                const newUsername = uuid();
                const newUser = {
                    username: newUsername,
                    type: 'STANDARD',
                    realName: `${newUsername}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${newUsername}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `new_user_id_${newUsername}`
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

                /* setup role */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOneAndUpdate({
                    id: setupRole.id,
                    deleted: null
                }, { $push: { permissions: permissions.dataset_specific.view_dataset, users: newUser.id } }, { returnOriginal: false });
                expect(role.value).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [permissions.dataset_specific.view_dataset],
                    createdBy: adminId,
                    users: [newUser.id],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        permissionChanges: {
                            add: [
                                permissions.dataset_specific.projects.create_new_projects,
                                permissions.dataset_specific.projects.create_new_projects
                            ],
                            remove: [
                                permissions.dataset_specific.view_dataset
                            ]
                        },
                        userChanges: {
                            add: [adminId],
                            remove: [newUser.id]
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupRole.studyId,
                    projectId: null,
                    permissions: [
                        permissions.dataset_specific.projects.create_new_projects,

                    ],
                    users: [{
                        id: adminId,
                        organisation: 'DSI',
                        realName: 'admin',
                    }]
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: null,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [
                        permissions.dataset_specific.projects.create_new_projects,
                    ],
                    users: [adminId],
                    createdBy: adminId,
                    deleted: null
                });
            });
        });

        describe('EDIT PROJECT ROLE', () => {
            let setupStudy;
            let setupProject;
            let setupRole;
            let authorisedUser;
            let authorisedUserProfile;
            beforeEach(async () => {
                /* setup: creating a setup study */
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

                /* setup: creating a project */
                const projectName = uuid();
                setupProject = {
                    id: `id_${projectName}`,
                    studyId: setupStudy.id,
                    createdBy: adminId,
                    patientMapping: {},
                    name: projectName,
                    approvedFields: {},
                    approvedFiles: [],
                    lastModified: 12103214,
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
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `new_user_id_${username}`
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(authorisedUserProfile);

                authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

                /* setup: giving authorised user privilege */
                const roleId = [uuid(), uuid()];
                const authorisedUserRole = {
                    id: roleId[0],
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: `${roleId[0]}_rolename`,
                    permissions: [
                        permissions.project_specific.roles.create_project_roles,
                        permissions.project_specific.roles.edit_project_role_name,
                        permissions.project_specific.roles.edit_project_role_users,
                        permissions.project_specific.roles.edit_project_role_permissions,
                        permissions.project_specific.roles.delete_project_roles,
                    ],
                    createdBy: adminId,
                    users: [authorisedUserProfile.id],
                    deleted: null
                };

                setupRole = {
                    id: roleId[1],
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: `${roleId[1]}_rolename`,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                };
                await mongoClient.collection(config.database.collections.roles_collection).insertMany([setupRole, authorisedUserRole]);
            });

            test('Change role name (admin)', async () => {
                const newRoleName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        name: newRoleName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: newRoleName,
                    studyId: setupStudy.id,
                    projectId: setupProject.id,
                    permissions: [],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: newRoleName,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Change role name (privileged user)', async () => {
                const newRoleName = uuid();
                const res = await authorisedUser.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        name: newRoleName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: newRoleName,
                    studyId: setupStudy.id,
                    projectId: setupProject.id,
                    permissions: [],
                    users: []
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: newRoleName,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Change role name (user without privilege) (should fail)', async () => {
                const newRoleName = uuid();
                const oldName = setupRole.name;
                const res = await user.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        name: newRoleName
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: oldName,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Add a non-existent user to role (admin)', async () => {
                /* setup: confirm that role has no user yet */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOne({
                    id: setupRole.id,
                    deleted: null
                });
                expect(role).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        userChanges: {
                            add: ['Iamafakeuser'],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_MALFORMED_INPUT);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Add user to role (privileged user)', async () => {
                /* setup: create a user to be added to role */
                const newUsername = uuid();
                const newUser = {
                    username: newUsername,
                    type: 'STANDARD',
                    realName: `${newUsername}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${newUsername}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `new_user_id_${newUsername}`
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

                /* test */
                const res = await authorisedUser.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        userChanges: {
                            add: [newUser.id],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.editRole).toEqual({
                    id: setupRole.id,
                    name: setupRole.name,
                    studyId: setupStudy.id,
                    projectId: setupProject.id,
                    permissions: [],
                    users: [{
                        id: newUser.id,
                        organisation: newUser.organisation,
                        realName: newUser.realName
                    }]
                });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [newUser.id],
                    deleted: null
                });
            });

            test('Add user to role (user without privilege) (should fail)', async () => {
                /* setup: create a user to be added to role */
                const newUsername = uuid();
                const newUser = {
                    username: newUsername,
                    type: 'STANDARD',
                    realName: `${newUsername}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${newUsername}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `new_user_id_${newUsername}`
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

                /* test */
                const res = await user.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        userChanges: {
                            add: [newUser.id],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });

            test('Adding a study permission to project role (admin) (should fail)', async () => {
                /* setup: confirm that role has no permissions yet */
                const role = await mongoClient.collection(config.database.collections.roles_collection).findOne({
                    id: setupRole.id,
                    deleted: null
                });
                expect(role).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });

                /* test */
                const res = await admin.post('/graphql').send({
                    query: print(EDIT_ROLE),
                    variables: {
                        roleId: setupRole.id,
                        permissionChanges: {
                            add: [
                                permissions.dataset_specific.roles.create_dataset_roles
                            ],
                            remove: []
                        }
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_MALFORMED_INPUT);
                expect(res.body.data.editRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole).toEqual({
                    _id: setupRole._id,
                    id: setupRole.id,
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: setupRole.name,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                });
            });
        });
    });

    describe('DELETING ROLE', () => {
        describe('DELETE STUDY ROLE', () => {
            let setupStudy;
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

                /* setup: creating a privileged user (not yet added roles) */
                const username = uuid();
                authorisedUserProfile = {
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

                authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

                /* setup: giving authorised user privilege */
                const roleId = [uuid(), uuid()];
                const authorisedUserRole = {
                    id: roleId[0],
                    projectId: null,
                    studyId: setupStudy.id,
                    name: `${roleId[0]}_rolename`,
                    permissions: [
                        permissions.dataset_specific.roles.create_dataset_roles,
                        permissions.dataset_specific.roles.delete_dataset_roles,
                        permissions.dataset_specific.roles.edit_dataset_role_users,
                        permissions.dataset_specific.roles.edit_dataset_role_name,
                        permissions.dataset_specific.roles.edit_dataset_role_permissions,

                    ],
                    createdBy: adminId,
                    users: [authorisedUserProfile.id],
                    deleted: null
                };

                setupRole = {
                    id: roleId[1],
                    projectId: null,
                    studyId: setupStudy.id,
                    name: `${roleId[1]}_rolename`,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                };
                await mongoClient.collection(config.database.collections.roles_collection).insertMany([setupRole, authorisedUserRole]);
            });

            test('delete a study role (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(REMOVE_ROLE),
                    variables: {
                        roleId: setupRole.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.removeRole).toEqual({ successful: true });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(typeof createdRole.deleted).toBe('number');
            });

            test('delete a study role (privileged user)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(REMOVE_ROLE),
                    variables: {
                        roleId: setupRole.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.removeRole).toEqual({ successful: true });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(typeof createdRole.deleted).toBe('number');
            });

            test('delete a study role (user with no privilege) (should fail)', async () => {
                const res = await user.post('/graphql').send({
                    query: print(REMOVE_ROLE),
                    variables: {
                        roleId: setupRole.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
                expect(res.body.data.removeRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole.deleted).toBe(null);
            });

            test('delete a non-existent role (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(REMOVE_ROLE),
                    variables: {
                        roleId: 'iamafakerole!'
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toHaveLength(1);
                expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                expect(res.body.data.removeRole).toEqual(null);
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(createdRole.deleted).toBe(null);
            });
        });

        describe('DELETE PROJECT ROLE', () => {
            let setupStudy;
            let setupProject;
            let setupRole;
            let authorisedUser;
            let authorisedUserProfile;
            beforeEach(async () => {
                /* setup: creating a setup study */
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

                /* setup: creating a project */
                const projectName = uuid();
                setupProject = {
                    id: `id_${projectName}`,
                    studyId: setupStudy.id,
                    createdBy: adminId,
                    patientMapping: {},
                    name: projectName,
                    approvedFields: {},
                    approvedFiles: [],
                    lastModified: 12103214,
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
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@example.com`,
                    description: 'I am a new user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `new_user_id_${username}`
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(authorisedUserProfile);

                authorisedUser = request.agent(app);
                await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

                /* setup: giving authorised user privilege */
                const roleId = [uuid(), uuid()];
                const authorisedUserRole = {
                    id: roleId[0],
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: `${roleId[0]}_rolename`,
                    permissions: [
                        permissions.project_specific.roles.create_project_roles,
                        permissions.project_specific.roles.edit_project_role_users,
                        permissions.project_specific.roles.edit_project_role_permissions,
                        permissions.project_specific.roles.edit_project_role_name,
                        permissions.project_specific.roles.delete_project_roles,
                    ],
                    createdBy: adminId,
                    users: [authorisedUserProfile.id],
                    deleted: null
                };

                setupRole = {
                    id: roleId[1],
                    projectId: setupProject.id,
                    studyId: setupStudy.id,
                    name: `${roleId[1]}_rolename`,
                    permissions: [],
                    createdBy: adminId,
                    users: [],
                    deleted: null
                };
                await mongoClient.collection(config.database.collections.roles_collection).insertMany([setupRole, authorisedUserRole]);
            });

            test('delete a project role (admin)', async () => {
                const res = await admin.post('/graphql').send({
                    query: print(REMOVE_ROLE),
                    variables: {
                        roleId: setupRole.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.removeRole).toEqual({ successful: true });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(typeof createdRole.deleted).toBe('number');
            });

            test('delete a project role (privileged user)', async () => {
                const res = await authorisedUser.post('/graphql').send({
                    query: print(REMOVE_ROLE),
                    variables: {
                        roleId: setupRole.id
                    }
                });
                expect(res.status).toBe(200);
                expect(res.body.errors).toBeUndefined();
                expect(res.body.data.removeRole).toEqual({ successful: true });
                const createdRole = await mongoClient.collection(config.database.collections.roles_collection).findOne({ id: setupRole.id });
                expect(typeof createdRole.deleted).toBe('number');
            });
        });
    });
});

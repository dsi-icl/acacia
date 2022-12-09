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
    GET_STUDY,
    GET_USERS,
    EDIT_ROLE,
    ADD_NEW_ROLE,
    WHO_AM_I,
    CREATE_PROJECT,
    CREATE_STUDY,
    DELETE_STUDY,
    UPLOAD_DATA_IN_ARRAY,
    GET_DATA_RECORDS,
    CREATE_NEW_DATA_VERSION,
    CREATE_NEW_FIELD,
    CREATE_STANDARDIZATION,
    GET_STANDARDIZATION,
    DELETE_STANDARDIZATION,
    CREATE_ONTOLOGY_TREE
} from '@itmat-broker/itmat-models';
import { permissions, userTypes, IUser, studyType, IStudy, IProject, IRole } from '@itmat-broker/itmat-types';
import { Express } from 'express';


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
    config.database.mongo_url = connectionString;
    config.database.database = dbName;
    await db.connect(config.database, MongoClient.connect as any);
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

    describe('MINI END-TO-END API TEST, NO UI, NO DATA', () => {
        let createdProject;
        let createdStudy: { id: any; name: any; };
        let createdRole_study;
        let createdRole_study_manageProject;
        let createdRole_project;
        let createdUserAuthorised;  // profile
        let createdUserAuthorisedStudy;  // profile
        let createdUserAuthorisedStudyManageProjects;  // profile
        let authorisedUser: request.SuperTest<request.Test>; // client
        let authorisedUserStudy: request.SuperTest<request.Test>; // client
        let authorisedUserStudyManageProject; // client

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

            /* 2. create projects for the study */
            {
                const projectName = uuid();
                const res = await admin.post('/graphql').send({
                    query: print(CREATE_PROJECT),
                    variables: {
                        studyId: createdStudy.id,
                        projectName: projectName
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
                            add: [permissions.specific_study.specific_study_readonly_access, permissions.specific_study.specific_study_data_management],
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
                    permissions: [permissions.specific_study.specific_study_readonly_access, permissions.specific_study.specific_study_data_management],
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

        afterEach(async () => {
            await db.collections!.standardizations_collection.deleteMany({});
        });

        test('Create standardization (authorised user)', async () => {
            const res = await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$testField'],
                        path: ['testPath'],
                        joinByKeys: [],
                        stdRules: [
                            {
                                entry: 'fakeEntry',
                                source: 'value',
                                parameter: ['fakeValue'],
                                filters: null
                            }
                        ]
                    }
                }
            });
            const std = await db.collections!.standardizations_collection.findOne({});
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.createStandardization).toEqual({
                id: std?.id,
                studyId: createdStudy.id,
                type: 'fakeType',
                field: ['$testField'],
                path: ['testPath'],
                joinByKeys: [],
                stdRules: [
                    {
                        id: std?.stdRules[0]?.id,
                        entry: 'fakeEntry',
                        source: 'value',
                        parameter: ['fakeValue'],
                        filters: null
                    }
                ],
                deleted: null
            });
        });

        test('Create standardization (authorised user)', async () => {
            const res = await user.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$testField'],
                        path: ['testPath'],
                        joinByKeys: [],
                        stdRules: [
                            {
                                entry: 'fakeEntry',
                                source: 'value',
                                parameter: ['fakeValue'],
                                filters: null
                            }
                        ]
                    }
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
        });

        test('Get standardization (authorised user)', async () => {
            await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$testField'],
                        path: ['testPath'],
                        joinByKeys: [],
                        stdRules: [
                            {
                                entry: 'fakeEntry',
                                source: 'value',
                                parameter: ['fakeValue'],
                                filters: null
                            }
                        ]
                    }
                }
            });
            const std = await db.collections!.standardizations_collection.findOne({});
            const res = await authorisedUserStudy.post('/graphql').send({
                query: print(GET_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    type: 'fakeType'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.getStandardization[0]).toEqual({
                id: std?.id,
                studyId: createdStudy.id,
                type: 'fakeType',
                field: ['$testField'],
                path: ['testPath'],
                joinByKeys: [],
                stdRules: [
                    {
                        id: std?.stdRules[0]?.id,
                        entry: 'fakeEntry',
                        source: 'value',
                        parameter: ['fakeValue'],
                        filters: null
                    }
                ],
                deleted: null
            });
        });

        test('Get standardization (unauthorised user)', async () => {
            await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$testField'],
                        path: ['testPath'],
                        joinByKeys: [],
                        stdRules: [
                            {
                                entry: 'fakeEntry',
                                source: 'value',
                                parameter: ['fakeValue'],
                                filters: null
                            }
                        ]
                    }
                }
            });
            const res = await user.post('/graphql').send({
                query: print(GET_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    type: 'fakeType'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
        });

        test('Delete standardization (authorised user)', async () => {
            await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$testField'],
                        path: ['testPath'],
                        joinByKeys: [],
                        stdRules: [
                            {
                                entry: 'fakeEntry',
                                source: 'value',
                                parameter: ['fakeValue'],
                                filters: null
                            }
                        ]
                    }
                }
            });
            const std = await db.collections!.standardizations_collection.findOne({});
            const res = await authorisedUserStudy.post('/graphql').send({
                query: print(DELETE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    stdId: std?.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.deleteStandardization).toEqual({
                id: std?.id,
                successful: true
            });
        });

        test('Delete standardization (unauthorised user)', async () => {
            await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$testField'],
                        path: ['testPath'],
                        joinByKeys: [],
                        stdRules: [
                            {
                                entry: 'fakeEntry',
                                source: 'value',
                                parameter: ['fakeValue'],
                                filters: null
                            }
                        ]
                    }
                }
            });
            const std = await db.collections!.standardizations_collection.findOne({});
            const res = await user.post('/graphql').send({
                query: print(DELETE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    stdId: std?.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
        });

        test('Get standardized data (authorised user)', async () => {
            await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_NEW_FIELD),
                variables: {
                    studyId: createdStudy.id,
                    fieldInput: [
                        {
                            fieldId: '100',
                            fieldName: 'newField100',
                            tableName: 'test',
                            dataType: 'cat',
                            comments: 'test',
                            possibleValues: [
                                { code: '1', description: 'NOW' },
                                { code: '2', description: 'OLD' }
                            ]
                        },
                        {
                            fieldId: '101',
                            fieldName: 'newField101',
                            tableName: 'test',
                            dataType: 'cat',
                            comments: 'test',
                            possibleValues: [
                                { code: '1', description: 'TRUE' },
                                { code: '2', description: 'FALSE' }
                            ]
                        },
                        {
                            fieldId: '110',
                            fieldName: 'newField110',
                            tableName: 'test',
                            dataType: 'int',
                            comments: 'AGE'
                        },
                        {
                            fieldId: '111',
                            fieldName: 'newField111',
                            tableName: 'test',
                            dataType: 'cat',
                            comments: 'GENDER',
                            possibleValues: [
                                { code: '1', description: 'Male' },
                                { code: '2', description: 'Female' }
                            ]
                        }
                    ]
                }
            });
            await authorisedUserStudy.post('/graphql').send({
                query: print(UPLOAD_DATA_IN_ARRAY),
                variables: {
                    studyId: createdStudy.id,
                    data: [
                        { fieldId: '100', value: '1', subjectId: 'I7N3G6G', visitId: '1' },
                        { fieldId: '101', value: '2', subjectId: 'I7N3G6G', visitId: '1' },
                        { fieldId: '110', value: '25', subjectId: 'I7N3G6G', visitId: '1' },
                        { fieldId: '111', value: '1', subjectId: 'I7N3G6G', visitId: '1' },
                        { fieldId: '100', value: '2', subjectId: 'GR6R4AR', visitId: '1' },
                        { fieldId: '101', value: '1', subjectId: 'GR6R4AR', visitId: '1' },
                        { fieldId: '110', value: '35', subjectId: 'GR6R4AR', visitId: '1' },
                        { fieldId: '111', value: '2', subjectId: 'GR6R4AR', visitId: '1' },
                        { fieldId: '100', value: '1', subjectId: 'I7N3G6G', visitId: '2' },
                        { fieldId: '101', value: '2', subjectId: 'I7N3G6G', visitId: '2' },
                        { fieldId: '100', value: '1', subjectId: 'GR6R4AR', visitId: '2' },
                        { fieldId: '101', value: '2', subjectId: 'GR6R4AR', visitId: '2' }

                    ]
                }
            });
            await authorisedUser.post('/graphql').send({
                query: print(CREATE_ONTOLOGY_TREE),
                variables: {
                    studyId: createdStudy.id,
                    ontologyTree: {
                        name: 'fakeTree',
                        routes: [
                            {
                                path: ['QS', 'MFI'],
                                name: 'AGE',
                                field: ['$100'],
                                visitRange: []
                            },
                            {
                                path: ['QS', 'MFI'],
                                name: '',
                                field: ['$101'],
                                visitRange: []
                            },
                            {
                                path: ['DM'],
                                name: '',
                                field: ['$110'],
                                visitRange: []
                            },
                            {
                                path: ['DM'],
                                name: '',
                                field: ['$111'],
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
            await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$100'],
                        path: ['QS'],
                        joinByKeys: [],
                        stdRules: [
                            {
                                entry: 'entry_value',
                                source: 'value',
                                parameter: ['fakeValue100'],
                                filters: null
                            },
                            {
                                entry: 'entry_reserved',
                                source: 'reserved',
                                parameter: ['m_subjectId'],
                                filters: null
                            },
                            {
                                entry: 'entry_inc',
                                source: 'inc',
                                parameter: ['m_subjectId'],
                                filters: null
                            },
                            {
                                entry: 'entry_data',
                                source: 'data',
                                parameter: [],
                                filters: null
                            },
                            {
                                entry: 'entry_field',
                                source: 'fieldDef',
                                parameter: ['comments'],
                                filters: null
                            },
                            {
                                entry: 'visit',
                                source: 'reserved',
                                parameter: ['m_visitId'],
                                filters: null
                            }
                        ]
                    }
                }
            });
            await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$101'],
                        path: ['QS'],
                        joinByKeys: [],
                        stdRules: [
                            {
                                entry: 'entry_value',
                                source: 'value',
                                parameter: ['fakeValue101'],
                                filters: null
                            },
                            {
                                entry: 'entry_reserved',
                                source: 'reserved',
                                parameter: ['m_subjectId'],
                                filters: null
                            },
                            {
                                entry: 'entry_inc',
                                source: 'inc',
                                parameter: ['m_subjectId'],
                                filters: null
                            },
                            {
                                entry: 'entry_data',
                                source: 'data',
                                parameter: [],
                                filters: null
                            },
                            {
                                entry: 'entry_field',
                                source: 'fieldDef',
                                parameter: ['comments'],
                                filters: null
                            },
                            {
                                entry: 'visit',
                                source: 'reserved',
                                parameter: ['m_visitId'],
                                filters: null
                            }
                        ]
                    }
                }
            });
            await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$110'],
                        path: ['DM'],
                        joinByKeys: ['entry_reserved'],
                        stdRules: [
                            {
                                entry: 'entry_reserved',
                                source: 'reserved',
                                parameter: ['m_subjectId'],
                                filters: null
                            },
                            {
                                entry: 'index',
                                source: 'inc',
                                parameter: ['DM'],
                                filters: null
                            },
                            {
                                entry: 'entry_data_age',
                                source: 'data',
                                parameter: [],
                                filters: null
                            }
                        ]
                    }
                }
            });
            await authorisedUserStudy.post('/graphql').send({
                query: print(CREATE_STANDARDIZATION),
                variables: {
                    studyId: createdStudy.id,
                    standardization: {
                        type: 'fakeType',
                        field: ['$111'],
                        path: ['DM'],
                        joinByKeys: ['entry_reserved'],
                        stdRules: [
                            {
                                entry: 'entry_reserved',
                                source: 'reserved',
                                parameter: ['m_subjectId'],
                                filters: null
                            },
                            {
                                entry: 'index',
                                source: 'inc',
                                parameter: ['DM'],
                                filters: null
                            },
                            {
                                entry: 'entry_data_gender',
                                source: 'data',
                                parameter: [],
                                filters: {
                                    1: ['convert', 'M'],
                                    2: ['convert', 'F']
                                }
                            }
                        ]
                    }
                }
            });

            const res = await authorisedUserStudy.post('/graphql').send({
                query: print(GET_DATA_RECORDS),
                variables: {
                    studyId: createdStudy.id,
                    queryString: {
                        data_requested: ['100', '101', '110', '111'],
                        format: 'standardized-fakeType',
                        cohort: [[]],
                        new_fields: []
                    }
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.getDataRecords.data.QS.sort((a: { entry_reserved: string; entry_inc: number; }, b: { entry_reserved: any; entry_inc: number; }) => {
                return a.entry_reserved !== b.entry_reserved ? a.entry_reserved.localeCompare(b.entry_reserved)
                    : a.entry_inc - b.entry_inc;
            })).toEqual([
                {
                    entry_value: 'fakeValue100',
                    entry_reserved: 'GR6R4AR',
                    entry_inc: 1,
                    entry_data: '2',
                    entry_field: 'test',
                    visit: '1'
                },
                {
                    entry_value: 'fakeValue100',
                    entry_reserved: 'GR6R4AR',
                    entry_inc: 2,
                    entry_data: '1',
                    entry_field: 'test',
                    visit: '2'
                },
                {
                    entry_value: 'fakeValue101',
                    entry_reserved: 'GR6R4AR',
                    entry_inc: 3,
                    entry_data: '1',
                    entry_field: 'test',
                    visit: '1'
                },
                {
                    entry_value: 'fakeValue101',
                    entry_reserved: 'GR6R4AR',
                    entry_inc: 4,
                    entry_data: '2',
                    entry_field: 'test',
                    visit: '2'
                },
                {
                    entry_value: 'fakeValue100',
                    entry_reserved: 'I7N3G6G',
                    entry_inc: 1,
                    entry_data: '1',
                    entry_field: 'test',
                    visit: '1'
                },
                {
                    entry_value: 'fakeValue100',
                    entry_reserved: 'I7N3G6G',
                    entry_inc: 2,
                    entry_data: '1',
                    entry_field: 'test',
                    visit: '2'
                },
                {
                    entry_value: 'fakeValue101',
                    entry_reserved: 'I7N3G6G',
                    entry_inc: 3,
                    entry_data: '2',
                    entry_field: 'test',
                    visit: '1'
                },
                {
                    entry_value: 'fakeValue101',
                    entry_reserved: 'I7N3G6G',
                    entry_inc: 4,
                    entry_data: '2',
                    entry_field: 'test',
                    visit: '2'
                }
            ]);
            expect(res.body.data.getDataRecords.data.DM.sort((a: { entry_reserved: string; entry_inc: number; }, b: { entry_reserved: any; entry_inc: number; }) => {
                return a.entry_reserved !== b.entry_reserved ? a.entry_reserved.localeCompare(b.entry_reserved)
                    : a.entry_inc - b.entry_inc;
            })).toEqual([
                {
                    entry_reserved: 'GR6R4AR',
                    index: 2,
                    entry_data_age: 35,
                    entry_data_gender: 'F'
                },
                {
                    entry_reserved: 'I7N3G6G',
                    index: 1,
                    entry_data_age: 25,
                    entry_data_gender: 'M'
                }
            ]);
        });
    });
});

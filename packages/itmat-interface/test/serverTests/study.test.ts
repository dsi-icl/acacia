import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { errorCodes } from '../../src/graphql/errors';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from 'itmat-setup';
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
    userTypes,
    permissions,
    IDataEntry,
    IUser,
    IFile,
    IFieldEntry,
    IStudyDataVersion,
    IStudy,
    enumValueType,
    enumItemType
} from 'itmat-commons';

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

    /* claer all mocks */
    jest.clearAllMocks();
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

    /* Mock Date for testing */
    jest.spyOn(Date, 'now').mockImplementation(() => 1591134065000);
});

describe('STUDY API', () => {
    let adminId;

    beforeAll(async () => {
        /* setup: first retrieve the generated user id */
        const result = await mongoClient.collection(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
        adminId = result.filter(e => e.username === 'admin')[0].id;
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
                otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                type: userTypes.ADMIN,
                realName: 'admin',
                organisation: 'DSI',
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
                createdAt: 1591134065000,
                expiredAt: 1991134065000
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
                otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                type: userTypes.ADMIN,
                realName: 'admin',
                organisation: 'DSI',
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

            const study = await mongoClient.collection(config.database.collections.studies_collection).findOne({ id: newStudy.id });
            expect(typeof study.deleted).toBe('number');

            const resWhoAmIAfter = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
            expect(resWhoAmIAfter.status).toBe(200);
            expect(resWhoAmIAfter.body.data.errors).toBeUndefined();
            expect(resWhoAmIAfter.body.data.whoAmI).toEqual({
                username: 'admin',
                otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                type: userTypes.ADMIN,
                realName: 'admin',
                organisation: 'DSI',
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
        let testCounter = 0;
        let setupStudy;
        let setupProject;
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
                currentDataVersion: -1,
                dataVersions: []
            };
            await mongoClient.collection(config.database.collections.studies_collection).insertOne(setupStudy);

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
            await mongoClient.collection(config.database.collections.projects_collection).insertOne(setupProject);
        });

        afterEach(async () => {
            await mongoClient.collection(config.database.collections.studies_collection).updateOne({ id: setupStudy.id }, { $set: { deleted: 10000 } });
            await mongoClient.collection(config.database.collections.projects_collection).updateOne({ id: setupProject.id }, { $set: { deleted: 10000 } });
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
                name: projectName,
                patientMapping: {},
                approvedFields: {},
                approvedFiles: [],
                lastModified: createdProject.lastModified,
                deleted: null
            });
            expect(res.body.data.createProject).toEqual({
                id: createdProject.id,
                studyId: setupStudy.id,
                name: projectName,
            });

            /* cleanup: delete project */
            await mongoClient.collection(config.database.collections.projects_collection).updateOne({ id: createdProject.id }, { $set: { deleted: 10000 } });
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
                realName: `${username}_realname`,
                password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                email: `${username}@example.com`,
                resetPasswordRequests: [],
                description: 'I am a new user.',
                emailNotificationsActivated: true,
                organisation: 'DSI',
                deleted: null,
                id: `new_user_id_${username}`,
                createdAt: 1591134065000,
                expiredAt: 1991134065000
            };
            await mongoClient.collection(config.database.collections.users_collection).insertOne(authorisedUserProfile);

            const roleId = uuid();
            const newRole = {
                id: roleId,
                projectId: null,
                studyId: setupStudy.id,
                name: `${roleId}_rolename`,
                permissions: [
                    permissions.dataset_specific.projects.create_new_projects,
                ],
                users: [authorisedUserProfile.id],
                deleted: null
            };
            await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

            const authorisedUser = request.agent(app);
            await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

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
            });

            /* cleanup: delete project */
            await mongoClient.collection(config.database.collections.projects_collection).updateOne({ id: createdProject.id }, { $set: { deleted: 10000 } });
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
                realName: `${username}_realname`,
                password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                email: `${username}@example.com`,
                resetPasswordRequests: [],
                description: 'I am a new user.',
                emailNotificationsActivated: true,
                organisation: 'DSI',
                deleted: null,
                id: `new_user_id_${username}`,
                createdAt: 1591134065000,
                expiredAt: 1991134065000
            };
            await mongoClient.collection(config.database.collections.users_collection).insertOne(authorisedUserProfile);

            const roleId = uuid();
            const newRole = {
                id: roleId,
                projectId: null,
                studyId: setupStudy.id,
                name: `${roleId}_rolename`,
                permissions: [
                    permissions.dataset_specific.projects.delete_projects
                ],
                users: [authorisedUserProfile.id],
                deleted: null
            };
            await mongoClient.collection(config.database.collections.roles_collection).insertOne(newRole);

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
        let createdProject;
        let createdStudy;
        let createdRole_study;
        let createdRole_study_manageProject;
        let createdRole_project;
        let createdUserAuthorised;  // profile
        let createdUserAuthorisedStudy;  // profile
        let createdUserAuthorisedStudyManageProjects;  // profile
        let authorisedUser; // client
        let authorisedUserStudy; // client
        let authorisedUserStudyManageProject; // client
        const fieldTreeId = uuid();
        let mockFields: IFieldEntry[];
        let mockFiles: IFile[];
        let mockDataVersion: IStudyDataVersion;
        const newMockDataVersion: IStudyDataVersion = { // this is not added right away; but multiple tests uses this
            id: 'mockDataVersionId2',
            contentId: 'mockContentId2',
            version: '0.0.1',
            fileSize: '10000',
            uploadDate: '5000000',
            tag: 'hey',
            jobId: 'mockjobid2',
            extractedFrom: 'mockfile2',
            fieldTrees: []
        };

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

            /* x. mock - add data to the study */
            {
                mockDataVersion = {
                    id: 'mockDataVersionId',
                    contentId: 'mockContentId',
                    version: '0.0.1',
                    fileSize: '10000',
                    uploadDate: '5000000',
                    jobId: 'mockjobid',
                    extractedFrom: 'mockfile',
                    fieldTrees: [fieldTreeId]
                };
                const mockData: IDataEntry[] = [
                    {
                        m_eid: 'mock_patient1',
                        m_jobId: 'mockjobId',
                        m_study: createdStudy.id,
                        m_versionId: mockDataVersion.id,
                        31: {
                            0: {
                                0: 'male'
                            }
                        },
                        49: {
                            1: {
                                0: 'England'
                            },
                            2: {
                                0: 'Hong Kong'
                            }
                        }
                    },
                    {
                        m_eid: 'mock_patient2',
                        m_jobId: 'mockjobId',
                        m_study: createdStudy.id,
                        m_versionId: mockDataVersion.id,
                        31: {
                            0: {
                                0: 'female'
                            }
                        },
                        49: {
                            1: {
                                0: 'France'
                            },
                            2: {
                                0: 'England'
                            }
                        }
                    }
                ];
                mockFields = [
                    {
                        id: 'mockfield1',
                        studyId: createdStudy.id,
                        path: 'Demographic',
                        fieldId: 32,
                        fieldName: 'Sex',
                        valueType: enumValueType.CATEGORICAL,
                        possibleValues: ['male', 'female'],
                        itemType: enumItemType.CLINICAL,
                        numOfTimePoints: 1,
                        numOfMeasurements: 1,
                        startingTimePoint: 1,
                        startingMeasurement: 1,
                        jobId: 'mockjobId',
                        dateAdded: 2314231,
                        deleted: null,
                        fieldTreeId
                    },
                    {
                        id: 'mockfield2',
                        studyId: createdStudy.id,
                        path: 'Demographic',
                        fieldId: 32,
                        fieldName: 'Sex',
                        valueType: enumValueType.CATEGORICAL,
                        possibleValues: ['male', 'female'],
                        itemType: enumItemType.CLINICAL,
                        numOfTimePoints: 1,
                        numOfMeasurements: 1,
                        startingTimePoint: 1,
                        startingMeasurement: 1,
                        jobId: 'mockjobId',
                        dateAdded: 2314231,
                        deleted: null,
                        fieldTreeId: 'fieldTree2'
                    }
                ];

                mockFiles = [
                    {
                        id: 'mockfile1_id',
                        fileName: 'mockfile1_name',
                        studyId: createdStudy.id,
                        fileSize: 1000,
                        description: 'Just a test file1',
                        uploadedBy: adminId,
                        uri: 'fakeuri',
                        deleted: null
                    },
                    {
                        id: 'mockfile2_id',
                        fileName: 'mockfile2_name',
                        studyId: createdStudy.id,
                        fileSize: 1000,
                        description: 'Just a test file2',
                        uploadedBy: adminId,
                        uri: 'fakeuri2',
                        deleted: null
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

                createdRole_study_manageProject = await mongoClient.collection(config.database.collections.roles_collection).findOne({ name: roleName });
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

            /* 5. create an authorised project user (no role yet) */
            {
                const username = uuid();
                const newUser: IUser = {
                    username: username,
                    type: userTypes.STANDARD,
                    realName: `${username}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@user.io`,
                    resetPasswordRequests: [],
                    description: 'I am an authorised project user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `AuthorisedProjectUser_${username}`,
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);
                createdUserAuthorised = await mongoClient.collection(config.database.collections.users_collection).findOne({ username });
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
                            add: [permissions.project_specific.view_project],
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
                    permissions: [permissions.project_specific.view_project],
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
                    otpSecret: createdUserAuthorised.otpSecret,
                    type: userTypes.STANDARD,
                    realName: `${createdUserAuthorised.username}_realname`,
                    organisation: 'DSI',
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
                    realName: `${username}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}@user.io`,
                    resetPasswordRequests: [],
                    description: 'I am an authorised study user.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `AuthorisedStudyUser_${username}`,
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000
                };
                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);
                createdUserAuthorisedStudy = await mongoClient.collection(config.database.collections.users_collection).findOne({ username });
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
                            add: [permissions.dataset_specific.view_dataset],
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
                    permissions: [permissions.dataset_specific.view_dataset],
                    users: [{
                        id: createdUserAuthorisedStudy.id,
                        organisation: 'DSI',
                        realName: createdUserAuthorisedStudy.realName
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
                    otpSecret: createdUserAuthorisedStudy.otpSecret,
                    type: userTypes.STANDARD,
                    realName: `${createdUserAuthorisedStudy.username}_realname`,
                    organisation: 'DSI',
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
                    realName: `${username}_realname`,
                    password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    email: `${username}'@user.io'`,
                    resetPasswordRequests: [],
                    description: 'I am an authorised study user managing project.',
                    emailNotificationsActivated: true,
                    organisation: 'DSI',
                    deleted: null,
                    id: `AuthorisedStudyUserManageProject_${username}`,
                    createdAt: 1591134065000,
                    expiredAt: 1991134065000
                };

                await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);
                createdUserAuthorisedStudyManageProjects = await mongoClient.collection(config.database.collections.users_collection).findOne({ username });
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
                            add: [
                                permissions.dataset_specific.projects.create_new_projects,
                                permissions.dataset_specific.projects.delete_projects,
                                permissions.dataset_specific.projects.manage_project_approved_files,
                                permissions.dataset_specific.projects.manage_project_approved_fields
                            ],
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
                    permissions: [
                        permissions.dataset_specific.projects.create_new_projects,
                        permissions.dataset_specific.projects.delete_projects,
                        permissions.dataset_specific.projects.manage_project_approved_files,
                        permissions.dataset_specific.projects.manage_project_approved_fields
                    ],
                    users: [{
                        id: createdUserAuthorisedStudyManageProjects.id,
                        organisation: 'DSI',
                        realName: createdUserAuthorisedStudyManageProjects.realName
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
                    otpSecret: createdUserAuthorisedStudyManageProjects.otpSecret,
                    type: userTypes.STANDARD,
                    realName: `${createdUserAuthorisedStudyManageProjects.username}_realname`,
                    organisation: 'DSI',
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
                    otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                    type: userTypes.ADMIN,
                    realName: 'admin',
                    organisation: 'DSI',
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
                            name: createdStudy.name
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
                expect(res.body.data.getProject).toBe(null);
            }

            /* check projects and roles are also deleted */
            {
                const res = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
                expect(res.body.data.whoAmI).toEqual({
                    username: 'admin',
                    type: userTypes.ADMIN,
                    realName: 'admin',
                    organisation: 'DSI',
                    email: 'admin@example.com',
                    description: 'I am an admin user.',
                    id: adminId,
                    access: {
                        id: `user_access_obj_user_id_${adminId}`,
                        projects: [],
                        studies: []
                    }
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
                            permissions: [
                                permissions.dataset_specific.view_dataset
                            ],
                            projectId: null,
                            studyId: createdStudy.id,
                            users: [{
                                id: createdUserAuthorisedStudy.id,
                                organisation: 'DSI',
                                realName: createdUserAuthorisedStudy.realName,
                                username: createdUserAuthorisedStudy.username
                            }]
                        },
                        {
                            id: createdRole_study_manageProject.id,
                            name: createdRole_study_manageProject.name,
                            permissions: [
                                permissions.dataset_specific.projects.create_new_projects,
                                permissions.dataset_specific.projects.delete_projects,
                                permissions.dataset_specific.projects.manage_project_approved_files,
                                permissions.dataset_specific.projects.manage_project_approved_fields
                            ],
                            projectId: null,
                            studyId: createdStudy.id,
                            users: [{
                                id: createdUserAuthorisedStudyManageProjects.id,
                                organisation: 'DSI',
                                realName: createdUserAuthorisedStudyManageProjects.realName,
                                username: createdUserAuthorisedStudyManageProjects.username
                            }]
                        }
                    ],
                    files: [
                        {
                            id: 'mockfile1_id',
                            fileName: 'mockfile1_name',
                            studyId: createdStudy.id,
                            projectId: null,
                            fileSize: 1000,
                            description: 'Just a test file1',
                            uploadedBy: adminId
                        },
                        {
                            id: 'mockfile2_id',
                            fileName: 'mockfile2_name',
                            studyId: createdStudy.id,
                            projectId: null,
                            fileSize: 1000,
                            description: 'Just a test file2',
                            uploadedBy: adminId
                        }
                    ],
                    numOfSubjects: 2,
                    currentDataVersion: 0,
                    dataVersions: [{
                        id: 'mockDataVersionId',
                        contentId: 'mockContentId',
                        version: '0.0.1',
                        fileSize: '10000',
                        uploadDate: '5000000',
                        tag: null,
                        jobId: 'mockjobid',
                        extractedFrom: 'mockfile',
                        fieldTrees: [fieldTreeId]
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
                    approvedFields: {},
                    approvedFiles: [],
                    jobs: [],
                    roles: [
                        {
                            id: createdRole_project.id,
                            name: createdRole_project.name,
                            permissions: [permissions.project_specific.view_project],
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
                    fields: [],
                    files: []
                });
            }
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
                    files: []
                });
            }
        });

        test('Get study fields (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(GET_STUDY_FIELDS),
                variables: {
                    studyId: createdStudy.id,
                    fieldTreeId
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.getStudyFields).toEqual([
                {
                    id: 'mockfield1',
                    studyId: createdStudy.id,
                    path: 'Demographic',
                    fieldId: 32,
                    fieldName: 'Sex',
                    valueType: enumValueType.CATEGORICAL,
                    possibleValues: ['male', 'female'],
                    unit: null,
                    itemType: enumItemType.CLINICAL,
                    numOfTimePoints: 1,
                    numOfMeasurements: 1,
                    notes: null,
                    fieldTreeId
                }
            ]);
        });

        test('Get study fields (user with project privilege) (should fail)', async () => {
            const res = await authorisedUser.post('/graphql').send({
                query: print(GET_STUDY_FIELDS),
                variables: {
                    studyId: createdStudy.id,
                    fieldTreeId
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            expect(res.body.data.getStudyFields).toBe(null);
        });

        test('Edit project approved fields with fields that are not in the field tree (admin) (should fail)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(EDIT_PROJECT_APPROVED_FIELDS),
                variables: {
                    projectId: createdProject.id,
                    fieldTreeId,
                    approvedFields: ['fakefieldhere']
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe('Some of the fields provided in your changes are not valid.');
            expect(res.body.data.editProjectApprovedFields).toBe(null);
        });


        test('Edit project approved fields (admin)', async () => {
            const tentativeApprovedFields = mockFields.filter(e => e.fieldTreeId === fieldTreeId).reduce((a: string[], e) => [...a, e.id], []);
            const res = await admin.post('/graphql').send({
                query: print(EDIT_PROJECT_APPROVED_FIELDS),
                variables: {
                    projectId: createdProject.id,
                    fieldTreeId,
                    approvedFields: tentativeApprovedFields
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.editProjectApprovedFields).toEqual({
                id: createdProject.id,
                approvedFields: { // seen by study user
                    [fieldTreeId]: tentativeApprovedFields
                },
                fields: [  // seen by project user
                    {
                        fieldTreeId,
                        fieldsInFieldTree: [
                            {
                                id: 'mockfield1',
                                studyId: createdStudy.id,
                                path: 'Demographic',
                                fieldId: 32,
                                fieldName: 'Sex',
                                valueType: enumValueType.CATEGORICAL,
                                possibleValues: ['male', 'female'],
                                unit: null,
                                itemType: enumItemType.CLINICAL,
                                numOfTimePoints: 1,
                                numOfMeasurements: 1,
                                notes: null,
                                fieldTreeId
                            }
                        ]
                    }
                ]
            });
            /* cleanup: revert the adding of fields */
            await db.collections!.projects_collection.updateOne({ id: createdProject.id }, { $set: { approvedFields: {} } });
        });

        test('Edit project approved fields (user without privilege) (should fail)', async () => {
            const tentativeApprovedFields = mockFields.filter(e => e.fieldTreeId === fieldTreeId).reduce((a: string[], e) => [...a, e.id], []);
            const res = await user.post('/graphql').send({
                query: print(EDIT_PROJECT_APPROVED_FIELDS),
                variables: {
                    projectId: createdProject.id,
                    fieldTreeId,
                    approvedFields: tentativeApprovedFields
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            expect(res.body.data.editProjectApprovedFields).toEqual(null);
        });

        test('Edit project approved fields (user with study readonly privilege) (should fail)', async () => {
            const tentativeApprovedFields = mockFields.filter(e => e.fieldTreeId === fieldTreeId).reduce((a: string[], e) => [...a, e.id], []);
            const res = await authorisedUserStudy.post('/graphql').send({
                query: print(EDIT_PROJECT_APPROVED_FIELDS),
                variables: {
                    projectId: createdProject.id,
                    fieldTreeId,
                    approvedFields: tentativeApprovedFields
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            expect(res.body.data.editProjectApprovedFields).toEqual(null);
        });

        test('Edit project approved fields (user with study " manage project" privilege)', async () => {
            const tentativeApprovedFields = mockFields.filter(e => e.fieldTreeId === fieldTreeId).reduce((a: string[], e) => [...a, e.id], []);
            const res = await authorisedUserStudyManageProject.post('/graphql').send({
                query: print(EDIT_PROJECT_APPROVED_FIELDS),
                variables: {
                    projectId: createdProject.id,
                    fieldTreeId,
                    approvedFields: tentativeApprovedFields
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.editProjectApprovedFields).toEqual({
                id: createdProject.id,
                approvedFields: { // seen by study user
                    [fieldTreeId]: tentativeApprovedFields
                },
                fields: [  // seen by project user
                    {
                        fieldTreeId,
                        fieldsInFieldTree: [
                            {
                                id: 'mockfield1',
                                studyId: createdStudy.id,
                                path: 'Demographic',
                                fieldId: 32,
                                fieldName: 'Sex',
                                valueType: enumValueType.CATEGORICAL,
                                possibleValues: ['male', 'female'],
                                unit: null,
                                itemType: enumItemType.CLINICAL,
                                numOfTimePoints: 1,
                                numOfMeasurements: 1,
                                notes: null,
                                fieldTreeId
                            }
                        ]
                    }
                ]
            });
            /* cleanup: revert the adding of fields */
            await db.collections!.projects_collection.updateOne({ id: createdProject.id }, { $set: { approvedFields: {} } });
        });

        test('Edit project approved fields (user with project privilege) (should fail)', async () => {
            const tentativeApprovedFields = mockFields.filter(e => e.fieldTreeId === fieldTreeId).reduce((a: string[], e) => [...a, e.id], []);
            const res = await authorisedUser.post('/graphql').send({
                query: print(EDIT_PROJECT_APPROVED_FIELDS),
                variables: {
                    projectId: createdProject.id,
                    fieldTreeId,
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
                    fileSize: mockFiles[0].fileSize,
                    description: mockFiles[0].description,
                    uploadedBy: adminId
                }]
            });
            expect(typeof editProjectApprovedFiles.id).toEqual('string');
            expect(typeof editProjectApprovedFiles.files[0].fileName).toEqual('string');
            expect(typeof editProjectApprovedFiles.files[0].studyId).toEqual('string');
            expect(typeof editProjectApprovedFiles.files[0].fileSize).toEqual('number');
            expect(typeof editProjectApprovedFiles.files[0].description).toEqual('string');
            expect(typeof editProjectApprovedFiles.files[0].uploadedBy).toEqual('string');

            /* cleanup: reverse adding project approvedfiles */
            await mongoClient.collection(config.database.collections.projects_collection).updateOne({ id: createdProject.id }, { $set: { approvedFiles: [] } });
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
                    fileSize: mockFiles[0].fileSize,
                    description: mockFiles[0].description,
                    uploadedBy: adminId
                }]
            });
            expect(typeof editProjectApprovedFiles.id).toEqual('string');
            expect(typeof editProjectApprovedFiles.files[0].fileName).toEqual('string');
            expect(typeof editProjectApprovedFiles.files[0].studyId).toEqual('string');
            expect(typeof editProjectApprovedFiles.files[0].fileSize).toEqual('number');
            expect(typeof editProjectApprovedFiles.files[0].description).toEqual('string');
            expect(typeof editProjectApprovedFiles.files[0].uploadedBy).toEqual('string');

            /* cleanup: reverse adding project approvedfiles */
            await mongoClient.collection(config.database.collections.projects_collection).updateOne({ id: createdProject.id }, { $set: { approvedFiles: [] } });
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
                currentDataVersion: 2,
                dataVersions: [
                    { ...mockDataVersion, tag: null },
                    { ...newMockDataVersion },
                    { ...mockDataVersion, tag: null, id: study?.dataVersions?.[2]?.id }
                ]
            });
            // content id should be the same be id is different
            expect(res.body.data.setDataversionAsCurrent.dataVersions[2].id).not.toBe(res.body.data.setDataversionAsCurrent.dataVersions[0].id);
            expect(study?.dataVersions?.[2]?.id).not.toBe(study?.dataVersions?.[0]?.id);
            expect(res.body.data.setDataversionAsCurrent.dataVersions[2].contentId).toBe(res.body.data.setDataversionAsCurrent.dataVersions[0].contentId);
            expect(study?.dataVersions?.[2]?.contentId).toBe(study?.dataVersions?.[0]?.contentId);

            /* cleanup: reverse setting dataversion */
            await mongoClient.collection(config.database.collections.studies_collection)
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
            await mongoClient.collection(config.database.collections.studies_collection)
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
            await mongoClient.collection(config.database.collections.studies_collection)
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
            await mongoClient.collection(config.database.collections.studies_collection)
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
            await mongoClient.collection(config.database.collections.studies_collection)
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
            await mongoClient.collection(config.database.collections.studies_collection)
                .updateOne({ id: createdStudy.id }, { $set: { dataVersions: [mockDataVersion], currentDataVersion: 0 } });
        });

        test('Set a previous study dataversion as current (user with study "manage data" privilege)', async () => {
            /* setup: create a new user */
            const userDataCurator: IUser = {
                id: uuid(),
                username: 'datacurator',
                password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
                otpSecret: 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA',
                email: 'user@ic.ac.uk',
                realName: 'DataCurator',
                organisation: 'DSI',
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
                permissions: [permissions.dataset_specific.data.select_current_dataversion],
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
                currentDataVersion: 2,
                dataVersions: [
                    { ...mockDataVersion, tag: null },
                    { ...newMockDataVersion },
                    { ...mockDataVersion, tag: null, id: study?.dataVersions?.[2]?.id }
                ]
            });
            // content id should be the same be id is different
            expect(res.body.data.setDataversionAsCurrent.dataVersions[2].id).not.toBe(res.body.data.setDataversionAsCurrent.dataVersions[0].id);
            expect(study?.dataVersions?.[2]?.id).not.toBe(study?.dataVersions?.[0]?.id);
            expect(res.body.data.setDataversionAsCurrent.dataVersions[2].contentId).toBe(res.body.data.setDataversionAsCurrent.dataVersions[0].contentId);
            expect(study?.dataVersions?.[2]?.contentId).toBe(study?.dataVersions?.[0]?.contentId);

            /* cleanup: reverse setting dataversion */
            await mongoClient.collection(config.database.collections.studies_collection)
                .updateOne({ id: createdStudy.id }, { $set: { dataVersions: [mockDataVersion], currentDataVersion: 0 } });

            /* cleanup: delete user and role */
            await db.collections!.users_collection.deleteOne({ id: userDataCurator.id });
            await db.collections!.roles_collection.deleteOne({ id: roleDataCurator.id });
        });


    });

    /**
     * setDataversion as current
     */
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { v4 as uuid } from 'uuid';
import { errorCodes } from '../../src/graphql/errors';
import { Db, MongoClient } from 'mongodb';
import { permissions, IJobEntry, IUser, IRole, IStudy, IProject, IQueryEntry, IFile } from '@itmat-broker/itmat-types';
import { CREATE_DATA_CURATION_JOB, CREATE_FIELD_CURATION_JOB, CREATE_QUERY_CURATION_JOB } from '@itmat-broker/itmat-models';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
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
});

describe('JOB API', () => {
    let adminId: any;
    let createdStudy: { id: any; name?: string; createdBy?: string; lastModified?: number; deleted?: null; currentDataVersion?: number; dataVersions?: never[]; };
    let createdProject: { id: any; name?: string; createdBy?: string; lastModified?: number; studyId?: string; deleted?: null; patientMapping?: Record<string, any>; approvedFields?: Record<string, any>; approvedFiles?: Record<string, any>; };
    let createdQuery: { id: any; requester?: string; queryString?: { date_requested: string; }; studyId?: string; projectId?: string; status?: string; error?: null; cancelled?: boolean; data_requested?: never[]; cohort?: never[][]; new_fields?: never[]; queryResult?: never[]; };
    let createdFile: { id: any; fileName?: string; studyId?: string; fileSize?: string; description?: string; uploadedBy?: any; uri?: string; deleted?: null; };

    beforeAll(async () => {
        /* setup: first retrieve the generated user id */
        const result = await mongoClient.collection<IUser>(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
        adminId = result.filter((e: { username: string; }) => e.username === 'admin')[0].id;
    });

    describe('CREATE DATA CURATION API', () => {
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
            await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(createdStudy);

            /* setup: created file entry in the database */
            const fileName = uuid();
            createdFile = {
                id: `new_file_id_${fileName}`,
                fileName: fileName + '.csv',
                studyId: createdStudy.id,
                fileSize: '1000',
                description: 'just a test file here.',
                uploadedBy: adminId,
                uri: `new_file_uri_${fileName}`,
                deleted: null
            };
            await mongoClient.collection<IFile>(config.database.collections.files_collection).insertOne(createdFile);
        });

        test('Create a data curation job with tag (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_DATA_CURATION_JOB),
                variables: {
                    file: [createdFile.id],
                    studyId: createdStudy.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(res.body.data.createDataCurationJob).toEqual([{
                id: job.id,
                jobType: 'DATA_UPLOAD_CSV',
                projectId: null,
                studyId: createdStudy.id,
                requester: adminId,
                requestTime: job.requestTime,
                receivedFiles: [createdFile.id],
                status: 'QUEUED',
                error: null,
                cancelled: false,
                cancelledTime: null,
                data: null
            }]);
        });

        test('Create a data curation job without tag (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_DATA_CURATION_JOB),
                variables: {
                    file: [createdFile.id],
                    studyId: createdStudy.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(res.body.data.createDataCurationJob).toEqual([{
                id: job.id,
                jobType: 'DATA_UPLOAD_CSV',
                projectId: null,
                studyId: createdStudy.id,
                requester: adminId,
                requestTime: job.requestTime,
                receivedFiles: [createdFile.id],
                status: 'QUEUED',
                error: null,
                cancelled: false,
                cancelledTime: null,
                data: null
            }]);
        });

        test('Create a data curation job (user with no privilege)', async () => {
            const res = await user.post('/graphql').send({
                query: print(CREATE_DATA_CURATION_JOB),
                variables: {
                    file: [createdFile.id],
                    studyId: createdStudy.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
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
            await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(authorisedUserProfile);

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
            await mongoClient.collection<IRole>(config.database.collections.roles_collection).insertOne(newRole);

            const authorisedUser = request.agent(app);
            await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

            /* test */
            const res = await authorisedUser.post('/graphql').send({
                query: print(CREATE_DATA_CURATION_JOB),
                variables: {
                    file: [createdFile.id],
                    studyId: createdStudy.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(res.body.data.createDataCurationJob).toEqual([{
                id: job.id,
                jobType: 'DATA_UPLOAD_CSV',
                projectId: null,
                studyId: createdStudy.id,
                requester: authorisedUserProfile.id,
                requestTime: job.requestTime,
                receivedFiles: [createdFile.id],
                status: 'QUEUED',
                error: null,
                cancelled: false,
                cancelledTime: null,
                data: null
            }]);
        });

        test('Create a data curation job with a non-existent file id (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_DATA_CURATION_JOB),
                variables: {
                    file: ['fakeFile'],
                    studyId: createdStudy.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(job).toBe(null);
        });

        test('Create a data curation job with a non-existent study id (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_DATA_CURATION_JOB),
                variables: {
                    file: [createdFile.id],
                    studyId: 'fakeStudyId'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe('Study does not exist.');
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(job).toBe(null);
        });

        test('Create a data curation job with a non-existent study id (user)', async () => {
            const res = await user.post('/graphql').send({
                query: print(CREATE_DATA_CURATION_JOB),
                variables: {
                    file: [createdFile.id],
                    studyId: createdStudy.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(job).toBe(null);
        });
    });

    describe('CREATE FIELD CURATION API', () => {
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
            await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(createdStudy);

            /* setup: created file entry in the database */
            const fileName = uuid();
            createdFile = {
                id: `new_file_id_${fileName}`,
                fileName: fileName + '.csv',
                studyId: createdStudy.id,
                fileSize: '1000',
                description: 'just a test file here.',
                uploadedBy: adminId,
                uri: `new_file_uri_${fileName}`,
                deleted: null
            };
            await mongoClient.collection<IFile>(config.database.collections.files_collection).insertOne(createdFile);
        });

        test('Create a field curation job with tag (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_FIELD_CURATION_JOB),
                variables: {
                    file: createdFile.id,
                    studyId: createdStudy.id,
                    tag: 'mockTag'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(res.body.data.createFieldCurationJob).toEqual({
                id: job.id,
                jobType: 'FIELD_INFO_UPLOAD',
                projectId: null,
                studyId: createdStudy.id,
                requester: adminId,
                requestTime: job.requestTime,
                receivedFiles: [createdFile.id],
                status: 'QUEUED',
                error: null,
                cancelled: false,
                cancelledTime: null,
                data: {
                    tag: 'mockTag'
                }
            });
        });

        test('Create a field curation job without tag (admin) (should fail)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_FIELD_CURATION_JOB),
                variables: {
                    file: createdFile.id,
                    studyId: createdStudy.id,
                    tag: undefined
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
        });

        test('Create a data curation job (user with no privilege)', async () => {
            const res = await user.post('/graphql').send({
                query: print(CREATE_FIELD_CURATION_JOB),
                variables: {
                    file: createdFile.id,
                    studyId: createdStudy.id,
                    tag: 'mockTag'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(job).toBe(null);
        });

        test('Create a field curation job (user with privilege)', async () => {
            /* setup: creating a privileged user */
            const username = uuid();
            const authorisedUserProfile = {
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
            await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(authorisedUserProfile);

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
            await mongoClient.collection<IRole>(config.database.collections.roles_collection).insertOne(newRole);

            const authorisedUser = request.agent(app);
            await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

            /* test */
            const res = await authorisedUser.post('/graphql').send({
                query: print(CREATE_FIELD_CURATION_JOB),
                variables: {
                    file: createdFile.id,
                    studyId: createdStudy.id,
                    tag: 'mockTag'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(res.body.data.createFieldCurationJob).toEqual({
                id: job.id,
                studyId: createdStudy.id,
                projectId: null,
                jobType: 'FIELD_INFO_UPLOAD',
                requester: authorisedUserProfile.id,
                requestTime: job.requestTime,
                receivedFiles: [createdFile.id],
                status: 'QUEUED',
                error: null,
                cancelled: false,
                cancelledTime: null,
                data: {
                    tag: 'mockTag'
                }
            });
        });

        test('Create a field curation job with a non-existent file id (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_FIELD_CURATION_JOB),
                variables: {
                    file: 'fake_file_id',
                    studyId: createdStudy.id,
                    tag: 'just_a_tag'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(job).toBe(null);
        });

        test('Create a field curation job with a non-existent study id (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_FIELD_CURATION_JOB),
                variables: {
                    file: createdFile.id,
                    studyId: 'fake_study_id',
                    tag: 'just_a_tag'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe('Study does not exist.');
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(job).toBe(null);
        });

        test('Create a field curation job with a non-existent study id (user)', async () => {
            const res = await user.post('/graphql').send({
                query: print(CREATE_FIELD_CURATION_JOB),
                variables: {
                    file: createdFile.id,
                    studyId: 'fake_study_id',
                    tag: 'just_a_tag'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                receivedFiles: createdFile.id
            });
            expect(job).toBe(null);
        });
    });

    describe('CREATE QUERY CURATION API', () => {
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
            await mongoClient.collection<IStudy>(config.database.collections.studies_collection).insertOne(createdStudy);

            /* setup: create a study to upload file to */
            const projectname = uuid();
            createdProject = {
                id: `new_project_id_${projectname}`,
                name: projectname,
                createdBy: 'admin',
                lastModified: 200000002,
                studyId: createdStudy.id,
                deleted: null,
                patientMapping: {},
                approvedFields: {},
                approvedFiles: {}
            };
            await mongoClient.collection<IProject>(config.database.collections.projects_collection).insertOne(createdProject);


            /* setup: created query entry in the database */
            const queryId = uuid();
            createdQuery = {
                id: `new_query_id_${queryId}`,
                requester: 'admin',
                queryString: { date_requested: 'test_query_string' },
                studyId: createdStudy.id,
                projectId: createdProject.id,
                status: 'QUEUED',
                error: null,
                cancelled: false,
                data_requested: [],
                cohort: [[]],
                new_fields: [],
                queryResult: []
            };
            await mongoClient.collection<IQueryEntry>(config.database.collections.queries_collection).insertOne(createdQuery);
        });

        test('Create a query curation job (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_QUERY_CURATION_JOB),
                variables: {
                    queryId: createdQuery.id,
                    studyId: createdStudy.id,
                    projectId: createdProject.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                'data.queryId': createdQuery.id
            });
            expect(res.body.data.createQueryCurationJob).toEqual({
                id: job.id,
                studyId: createdStudy.id,
                projectId: null,
                jobType: 'QUERY_EXECUTION',
                requester: adminId,
                requestTime: job.requestTime,
                receivedFiles: [],
                status: 'QUEUED',
                error: null,
                cancelled: false,
                cancelledTime: null,
                data: {
                    queryId: [createdQuery.id],
                    projectId: createdProject.id,
                    studyId: createdStudy.id
                }
            });
        });

        test('Create a query curation job (user with no privilege)', async () => {
            const res = await user.post('/graphql').send({
                query: print(CREATE_QUERY_CURATION_JOB),
                variables: {
                    queryId: createdQuery.id,
                    studyId: createdStudy.id,
                    projectId: createdProject.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                'data.queryId': createdQuery.id
            });
            expect(job).toBe(null);
        });

        test('Create a query curation job (user with privilege)', async () => {
            /* setup: creating a privileged user */
            const username = uuid();
            const authorisedUserProfile = {
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
            await mongoClient.collection<IUser>(config.database.collections.users_collection).insertOne(authorisedUserProfile);

            const roleId = uuid();
            const newRole = {
                id: roleId,
                projectId: createdProject.id,
                studyId: createdStudy.id,
                name: `${roleId}_rolename`,
                permissions: [
                    permissions.specific_project.specific_project_readonly_access
                ],
                users: [authorisedUserProfile.id],
                deleted: null
            };
            await mongoClient.collection<IRole>(config.database.collections.roles_collection).insertOne(newRole);

            await mongoClient.collection<IRole>(config.database.collections.roles_collection).findOne({ id: roleId });
            const authorisedUser = request.agent(app);
            await connectAgent(authorisedUser, username, 'admin', authorisedUserProfile.otpSecret);

            /* test */
            const res = await authorisedUser.post('/graphql').send({
                query: print(CREATE_QUERY_CURATION_JOB),
                variables: {
                    queryId: createdQuery.id,
                    studyId: createdStudy.id,
                    projectId: createdProject.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                'data.queryId': createdQuery.id
            });
            expect(res.body.data.createQueryCurationJob).toEqual({
                id: job.id,
                studyId: createdStudy.id,
                projectId: null,
                jobType: 'QUERY_EXECUTION',
                requester: authorisedUserProfile.id,
                requestTime: job.requestTime,
                receivedFiles: [],
                status: 'QUEUED',
                error: null,
                cancelled: false,
                cancelledTime: null,
                data: {
                    queryId: [createdQuery.id],
                    projectId: createdProject.id,
                    studyId: createdStudy.id
                }
            });
        });

        test('Create a query curation job with a non-existent study id (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_QUERY_CURATION_JOB),
                variables: {
                    queryId: createdQuery.id,
                    studyId: 'fake_study_id',
                    projectId: createdProject.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe('Study does not exist.');
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                'data.queryId': createdQuery.id
            });
            expect(job).toBe(null);
        });

        test('Create a query curation job with a non-existent project id (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_QUERY_CURATION_JOB),
                variables: {
                    queryId: createdQuery.id,
                    studyId: createdStudy.id,
                    projectId: 'fake_project_id'
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe('Project does not exist.');
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                'data.queryId': createdQuery.id
            });
            expect(job).toBe(null);
        });

        test('Create a query curation job with a non-existent query id (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_QUERY_CURATION_JOB),
                variables: {
                    queryId: 'fake_query_id',
                    studyId: createdStudy.id,
                    projectId: createdProject.id
                }
            });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe('Query does not exist.');
            const job = await mongoClient.collection<IJobEntry>(config.database.collections.jobs_collection).findOne({
                'data.queryId': createdQuery.id
            });
            expect(job).toBe(null);
        });
    });
});

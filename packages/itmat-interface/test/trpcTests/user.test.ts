/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { MongoMemoryServer } from 'mongodb-memory-server';
import { db } from '../../src/database/database';
import { Express } from 'express';
import { objStore } from '../../src/objStore/objStore';
import request from 'supertest';
import { connectAdmin, connectUser } from './_loginHelper';
import { Router } from '../../src/server/router';
import { Db, MongoClient } from 'mongodb';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
import { IOrganisation, enumUserTypes } from '@itmat-broker/itmat-types';
import { encodeQueryParams } from './helper';
import { errorCodes } from '@itmat-broker/itmat-cores';

jest.mock('nodemailer', () => {
    const { TEST_SMTP_CRED, TEST_SMTP_USERNAME } = process.env;
    if (!TEST_SMTP_CRED || !TEST_SMTP_USERNAME || !config?.nodemailer?.auth?.pass || !config?.nodemailer?.auth?.user)
        return {
            createTransport: jest.fn().mockImplementation(() => ({
                sendMail: jest.fn()
            }))
        };
    return jest.requireActual('nodemailer');
});

if (global.hasMinio) {
    let app: Express;
    let mongodb: MongoMemoryServer;
    let admin: request.SuperTest<request.Test>;
    let user: request.SuperTest<request.Test>;
    let mongoConnection: MongoClient;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mongoClient: Db;
    let adminProfile;
    let userProfile;
    let organisation: IOrganisation;

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
        config.objectStore.port = global.minioContainerPort;
        config.database.mongo_url = connectionString;
        config.database.database = dbName;
        await db.connect(config.database, MongoClient);
        await objStore.connect(config.objectStore);
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

        // add the root node for each user
        const users = await db.collections.users_collection.find({}).toArray();
        adminProfile = users.filter(el => el.type === enumUserTypes.ADMIN)[0];
        userProfile = users.filter(el => el.type === enumUserTypes.STANDARD)[0];

        // add an organisation
        organisation = {
            id: uuid(),
            name: 'My Org',
            shortname: '',
            location: [],
            profile: null,
            metadata: {
            },
            life: {
                createdTime: 0,
                createdUser: 'SYSTEMAGENT',
                deletedUser: null,
                deletedTime: null
            }
        };
        await db.collections.organisations_collection.insertOne(organisation);
    });

    afterEach(async () => {
        await db.collections.studies_collection.deleteMany({});
        await db.collections.files_collection.deleteMany({});
        await db.collections.roles_collection.deleteMany({});
        await db.collections.field_dictionary_collection.deleteMany({});
        await db.collections.data_collection.deleteMany({});
        await db.collections.jobs_collection.deleteMany({});
        delete userProfile._id;
        await db.collections.users_collection.findOneAndUpdate({ id: userProfile.id }, {
            $set: userProfile
        });
        await db.collections.users_collection.deleteMany({ id: { $nin: [adminProfile.id, userProfile.id] } });
        await db.collections.configs_collection.deleteMany({ key: { $nin: [adminProfile.id, userProfile.id] } });
    });

    describe('tRPC User APIs', () => {
        test('Create a user', async () => {
            const response = await admin.post('/trpc/user.createUser')
                .send({
                    username: 'test',
                    firstname: 'firstname',
                    lastname: 'lastname',
                    email: 'test@test.com',
                    password: 'test_password',
                    description: '',
                    organisation: organisation.id
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data.username).toBe('test');
            const user = await db.collections.users_collection.findOne({ username: 'test' });
            expect(user).toBeDefined();
            expect(user.id).toBe(response.body.result.data.id);
        });
        test('Create a user (invalid email format)', async () => {
            const response = await admin.post('/trpc/user.createUser')
                .send({
                    username: 'test',
                    firstname: 'firstname',
                    lastname: 'lastname',
                    email: 'test@test',
                    password: 'test_password',
                    description: '',
                    organisation: organisation.id
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Email is not the right format.');
        });
        test('Create a user (invalid password format)', async () => {
            const response = await admin.post('/trpc/user.createUser')
                .send({
                    username: 'test',
                    firstname: 'firstname',
                    lastname: 'lastname',
                    email: 'test@test.com',
                    password: 'test',
                    description: '',
                    organisation: organisation.id
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Password has to be at least 8 character long.');
        });
        test('Create a user (username have spaces)', async () => {
            const response = await admin.post('/trpc/user.createUser')
                .send({
                    username: 'te st',
                    firstname: 'firstname',
                    lastname: 'lastname',
                    email: 'test@test.com',
                    password: 'test_password',
                    description: '',
                    organisation: organisation.id
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Username or password cannot have spaces.');
        });
        test('Create a user (password have spaces)', async () => {
            const response = await admin.post('/trpc/user.createUser')
                .send({
                    username: 'test',
                    firstname: 'firstname',
                    lastname: 'lastname',
                    email: 'test@test.com',
                    password: 'test_pa ssword',
                    description: '',
                    organisation: organisation.id
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Username or password cannot have spaces.');
        });
        test('Create a user (username already registered)', async () => {
            const response = await admin.post('/trpc/user.createUser')
                .send({
                    username: userProfile.username,
                    firstname: 'firstname',
                    lastname: 'lastname',
                    email: 'test@test.com',
                    password: 'test_password',
                    description: '',
                    organisation: organisation.id
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Username or email already exists.');
        });
        test('Create a user (email already registered)', async () => {
            const response = await admin.post('/trpc/user.createUser')
                .send({
                    username: 'test',
                    firstname: 'firstname',
                    lastname: 'lastname',
                    email: userProfile.email,
                    password: 'test_password',
                    description: '',
                    organisation: organisation.id
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Username or email already exists.');
        });
        test('Create a user (organisation does not exist)', async () => {
            const response = await admin.post('/trpc/user.createUser')
                .send({
                    username: 'test',
                    firstname: 'firstname',
                    lastname: 'lastname',
                    email: 'test@test.com',
                    password: 'test_password',
                    description: '',
                    organisation: 'random'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Organisation does not exist.');
        });
        test('Edit a user (admin)', async () => {
            const response = await admin.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    username: 'edit_username',
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: 'edit_email@test.com',
                    description: 'edit_description',
                    type: enumUserTypes.MANAGER
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data.username).toBe('edit_username');
            const editedUser = await db.collections.users_collection.findOne({ id: userProfile.id });
            expect(editedUser?.username).toBe('edit_username');
        });
        test('Edit a user (user)', async () => {
            const response = await user.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    username: 'edit_username',
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: 'edit_email@test.com',
                    password: 'edit_password',
                    description: 'edit_description'
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data.username).toBe('edit_username');
            const editedUser = await db.collections.users_collection.findOne({ id: userProfile.id });
            expect(editedUser?.username).toBe('edit_username');
        });
        test('Edit a user (user edit others accounts)', async () => {
            const response = await user.post('/trpc/user.editUser')
                .send({
                    userId: adminProfile.id,
                    username: 'edit_username',
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: 'edit_email@test.com',
                    password: 'edit_password',
                    description: 'edit_description'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('User can only edit his/her own account.');
        });
        test('Edit a user (user edit unpermitted fields)', async () => {
            const response = await user.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    username: 'edit_username',
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: 'edit_email@test.com',
                    password: 'edit_password',
                    description: 'edit_description',
                    type: enumUserTypes.ADMIN
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Standard user can not change their type, expiration time. Please contact admins for help.');
        });
        test('Edit a user (password not long enough)', async () => {
            const response = await user.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    username: 'edit_username',
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: 'edit_email@test.com',
                    password: 'edit_',
                    description: 'edit_description'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Password has to be at least 8 character long.');
        });
        test('Edit a user (email not right format)', async () => {
            const response = await user.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    username: 'edit_username',
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: 'edit_email@',
                    password: 'edit_password',
                    description: 'edit_description'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Email is not the right format.');
        });
        test('Edit a user (username already used)', async () => {
            const response = await user.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    username: adminProfile.username,
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: 'edit_email@test.com',
                    password: 'edit_password',
                    description: 'edit_description'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Username already used.');
        });
        test('Edit a user (email already used)', async () => {
            const response = await user.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    username: 'edit_username',
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: adminProfile.email,
                    password: 'edit_password',
                    description: 'edit_description'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Email already used.');
        });
        test('Edit a user (organisation does not exist)', async () => {
            const response = await admin.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    username: 'edit_username',
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: 'edit_email@test.com',
                    description: 'edit_description',
                    organisation: 'random'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Organisation does not exist.');
        });
        test('Edit a user (old password)', async () => {
            await user.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    password: 'edit_password'
                });
            const response = await user.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    password: 'edit_password'
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('You need to select a new password.');
        });
        test('Edit a user (expired time is outdated)', async () => {
            const response = await admin.post('/trpc/user.editUser')
                .send({
                    userId: userProfile.id,
                    username: 'edit_username',
                    firstname: 'edit_firstname',
                    lastname: 'edit_lastname',
                    email: 'edit_email@test.com',
                    description: 'edit_description',
                    expiredAt: Date.now() - 1000
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('Cannot set to a previous time.');
        });
        test('Get a user by admin (through userId)', async () => {
            const paramteres = {
                userId: userProfile.id
            };
            const response = await admin.get('/trpc/user.getUser?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data).toBeDefined();
            expect(response.body.result.data.username).toBe(userProfile.username);
        });
        test('Get a user by user (through userId)', async () => {
            const paramteres = {
                userId: adminProfile.id
            };
            const response = await user.get('/trpc/user.getUser?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(errorCodes.NO_PERMISSION_ERROR);
        });
        test('Get a user (through username)', async () => {
            const paramteres = {
                username: userProfile.username
            };
            const response = await user.get('/trpc/user.getUser?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data).toBeDefined();
            expect(response.body.result.data.username).toBe(userProfile.username);
        });
        test('Get a user (through email)', async () => {
            const paramteres = {
                email: userProfile.email
            };
            const response = await user.get('/trpc/user.getUser?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data).toBeDefined();
            expect(response.body.result.data.username).toBe(userProfile.username);
        });
        test('Get a user by user (user does not exist)', async () => {
            const paramteres = {
                email: 'random'
            };
            const response = await user.get('/trpc/user.getUser?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe(errorCodes.NO_PERMISSION_ERROR);
        });
        test('Get a user by admin (user does not exist)', async () => {
            const paramteres = {
                email: 'random'
            };
            const response = await admin.get('/trpc/user.getUser?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(400);
            expect(response.body.error.message).toBe('User does not exist.');
        });
        test('Get all users (admin)', async () => {
            const paramteres = {
            };
            const response = await admin.get('/trpc/user.getUsers?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(2);
        });
        test('Get all users (user)', async () => {
            const paramteres = {
            };
            const response = await user.get('/trpc/user.getUsers?input=' + encodeQueryParams(paramteres))
                .query({
                });
            expect(response.status).toBe(200);
            expect(response.body.result.data).toHaveLength(0);
        });
    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}

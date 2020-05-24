import request from 'supertest';
import { print } from 'graphql';
import { connectAdmin, connectUser, connectAgent } from './_loginHelper';
import { db } from '../../src/database/database';
import { Router } from '../../src/server/router';
import { errorCodes } from '../../src/graphql/errors';
import { MongoClient } from 'mongodb';
import * as itmatCommons from 'itmat-commons';
const { WHO_AM_I, GET_USERS, CREATE_USER, EDIT_USER, DELETE_USER } = itmatCommons.GQLRequests;
import { MongoMemoryServer } from 'mongodb-memory-server';
import setupDatabase from 'itmat-utils/src/databaseSetup/collectionsAndIndexes';
import config from '../../config/config.sample.json';
const { Models } = itmatCommons;

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

describe('USERS API', () => {
    describe('END USERS API', () => {
        let adminId;
        let userId;

        beforeAll(async () => {
            /* setup: first retrieve the generated user id */
            const result = await mongoClient.collection(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
            adminId = result.filter(e => e.username === 'admin')[0].id;
            userId = result.filter(e => e.username === 'standardUser')[0].id;
        });

        test('If someone not logged in made a request', async () => {
            const client_not_logged_in = request.agent(app);
            const res = await client_not_logged_in.post('/graphql').send({ query: print(GET_USERS), variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } });
            expect(res.status).toBe(200);
            expect(res.body.errors).toHaveLength(1);
            expect(res.body.errors[0].message).toBe(errorCodes.NOT_LOGGED_IN);
            expect(res.body.data.getUsers).toBe(null);
        });

        test('who am I (not logged in)', async () => {
            const client_not_logged_in = request.agent(app);
            const res = await client_not_logged_in.post('/graphql').send({ query: print(WHO_AM_I) });
            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.whoAmI).toBe(null);
        });

        test('Who am I (admin)',  async () => {
            const res = await admin.post('/graphql').send({ query: print(WHO_AM_I) });
            expect(res.status).toBe(200);
            expect(res.body.data.whoAmI.id).toBeDefined();
            adminId = res.body.data.whoAmI.id;
            expect(res.body.data.whoAmI).toEqual({
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

        test('Who am I (user)', async () => { 
            const res = await user.post('/graphql').send({ query: print(WHO_AM_I) });
            expect(res.status).toBe(200);
            expect(res.body.error).toBeUndefined();
            expect(res.body.data.whoAmI.id).toBeDefined();
            userId = res.body.data.whoAmI.id;
            expect(res.body.data.whoAmI).toEqual({
                username: 'standardUser', 
                type: Models.UserModels.userTypes.STANDARD, 
                realName: 'Chan Tai Man', 
                createdBy: 'admin', 
                organisation: 'DSI',
                email: 'standard@user.io', 
                description: 'I am a standard user.',
                id: userId,
                access: {
                    id: `user_access_obj_user_id_${userId}`,
                    projects: [],
                    studies: []
                }
            });
        });
    });

    // describe('APP USERS QUERY API', () => {
    //     let adminId;
    //     let userId;

    //     beforeAll(async () => {
    //         /* setup: first retrieve the generated user id */
    //         const result = await mongoClient.collection(config.database.collections.users_collection).find({}, { projection: { id: 1, username: 1 } }).toArray();
    //         adminId = result.filter(e => e.username === 'admin')[0].id;
    //         userId = result.filter(e => e.username === 'standardUser')[0].id;
    //     });

    //     test('Get all users list with detail (no access info) (admin)', async () => {
    //         const res = await admin.post('/graphql').send({ query: print(GET_USERS), variables: { fetchDetailsAdminOnly: true, fetchAccessPrivileges: false } });
    //         expect(res.status).toBe(200);
    //         expect(res.body.data.getUsers).toEqual([
    //             {
    //                 username: 'admin', 
    //                 type: Models.UserModels.userTypes.ADMIN, 
    //                 realName: 'admin', 
    //                 createdBy: 'chon', 
    //                 organisation: 'DSI',
    //                 email: 'admin@user.io', 
    //                 description: 'I am an admin user.',
    //                 id: adminId
    //             },
    //             {
    //                 username: 'standardUser', 
    //                 type: Models.UserModels.userTypes.STANDARD, 
    //                 realName: 'Chan Tai Man', 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI',
    //                 email: 'standard@user.io', 
    //                 description: 'I am a standard user.',
    //                 id: userId
    //             }
    //         ]);
    //     });

    //     test('Get all users list with detail (w/ access info) (admin)', async () => {
    //         const res = await admin.post('/graphql').send({ query: print(GET_USERS), variables: { fetchDetailsAdminOnly: true, fetchAccessPrivileges: true } });
    //         expect(res.status).toBe(200);
    //         expect(res.body.data.getUsers).toEqual([
    //             {
    //                 username: 'admin', 
    //                 type: Models.UserModels.userTypes.ADMIN, 
    //                 realName: 'admin', 
    //                 createdBy: 'chon', 
    //                 organisation: 'DSI',
    //                 email: 'admin@user.io', 
    //                 description: 'I am an admin user.',
    //                 id: adminId,
    //                 access: {
    //                     id: `user_access_obj_user_id_${adminId}`,
    //                     projects: [],
    //                     studies: []
    //                 }
    //             },
    //             {
    //                 username: 'standardUser', 
    //                 type: Models.UserModels.userTypes.STANDARD, 
    //                 realName: 'Chan Tai Man', 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI',
    //                 email: 'standard@user.io', 
    //                 description: 'I am a standard user.',
    //                 id: userId,
    //                 access: {
    //                     id: `user_access_obj_user_id_${userId}`,
    //                     projects: [],
    //                     studies: []
    //                 }
    //             }
    //         ]);
    //     });

    //     test('Get all users list with detail (no access info) (user) (should fail)', async () => {
    //         const res = await user.post('/graphql').send({ query: print(GET_USERS), variables: { fetchDetailsAdminOnly: true, fetchAccessPrivileges: false }});
    //         expect(res.status).toBe(200); //graphql returns 200 for application layer errors
    //         expect(res.body.errors).toHaveLength(3);
    //         expect(res.body.errors[0].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.data.getUsers).toEqual([   // user still has permission to his own data
    //             null,
    //             {
    //                 username: 'standardUser', 
    //                 type: Models.UserModels.userTypes.STANDARD, 
    //                 realName: 'Chan Tai Man', 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI',
    //                 email: 'standard@user.io', 
    //                 description: 'I am a standard user.',
    //                 id: userId
    //             }
    //         ]);
    //     });

    //     test('Get all users list with detail (w/ access info) (user) (should fail)', async () => {
    //         const res = await user.post('/graphql').send({ query: print(GET_USERS), variables: { fetchDetailsAdminOnly: true, fetchAccessPrivileges: true }});
    //         expect(res.status).toBe(200); //graphql returns 200 for application layer errors
    //         expect(res.body.errors).toHaveLength(4);
    //         expect(res.body.errors[0].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.errors[1].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.errors[2].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.errors[3].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.data.getUsers).toEqual([   // user still has permission to his own data
    //             null,
    //             {
    //                 username: 'standardUser', 
    //                 type: Models.UserModels.userTypes.STANDARD, 
    //                 realName: 'Chan Tai Man', 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI',
    //                 email: 'standard@user.io', 
    //                 description: 'I am a standard user.',
    //                 id: userId,
    //                 access: {
    //                     id: `user_access_obj_user_id_${userId}`,
    //                     projects: [],
    //                     studies: []
    //                 }
    //             }
    //         ]);
    //     });

    //     test('Get all users without details (admin)', async () => {
    //         const res = await admin.post('/graphql').send({ query: print(GET_USERS), variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } });
    //         expect(res.status).toBe(200);
    //         expect(res.body.error).toBeUndefined();
    //         expect(res.body.data.getUsers).toEqual([
    //             {
    //                 type: Models.UserModels.userTypes.ADMIN, 
    //                 realName: 'admin', 
    //                 createdBy: 'chon', 
    //                 organisation: 'DSI',
    //                 id: adminId
    //             },
    //             {
    //                 type: Models.UserModels.userTypes.STANDARD, 
    //                 realName: 'Chan Tai Man', 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI',
    //                 id: userId
    //             }
    //         ]);
    //     });

    //     test('Get all users without details (user)', async () => {
    //         const res = await user.post('/graphql').send({ query: print(GET_USERS), variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } });
    //         expect(res.status).toBe(200);
    //         expect(res.body.error).toBeUndefined();
    //         expect(res.body.data.getUsers).toEqual([
    //             {
    //                 type: Models.UserModels.userTypes.ADMIN, 
    //                 realName: 'admin', 
    //                 createdBy: 'chon', 
    //                 organisation: 'DSI',
    //                 id: adminId
    //             },
    //             {
    //                 type: Models.UserModels.userTypes.STANDARD, 
    //                 realName: 'Chan Tai Man', 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI',
    //                 id: userId
    //             }
    //         ]);
    //     });

    //     test('Get a specific user with details (admin)', async () => {
    //         const res = await admin.post('/graphql').send({ query: print(GET_USERS), variables: { userId, fetchDetailsAdminOnly: true, fetchAccessPrivileges: true } });
    //         expect(res.status).toBe(200);
    //         expect(res.body.data.getUsers instanceof Array).toBe(true);
    //         expect(res.body.data.getUsers).toEqual([
    //             {
    //                 username: 'standardUser', 
    //                 type: Models.UserModels.userTypes.STANDARD, 
    //                 realName: 'Chan Tai Man', 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI',
    //                 email: 'standard@user.io', 
    //                 description: 'I am a standard user.',
    //                 id: userId,
    //                 access: {
    //                     id: `user_access_obj_user_id_${userId}`,
    //                     projects: [],
    //                     studies: []
    //                 }
    //             }
    //         ]);
    //     });

    //     test('Get a specific non-self user with details (user) (should fail)', async () => {
    //         const res = await user.post('/graphql').send({ query: print(GET_USERS), variables: { userId: adminId, fetchDetailsAdminOnly: true, fetchAccessPrivileges: true } });
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(4);
    //         expect(res.body.errors[0].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.errors[1].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.errors[2].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.errors[3].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.data.getUsers).toEqual([
    //             null
    //         ]);
    //     });

    //     test('Get a specific non-self user without details (user) (should fail)', async () => {
    //         const res = await user.post('/graphql').send({ query: print(GET_USERS), variables: { userId: adminId, fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } });
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toBeUndefined();
    //         expect(res.body.data.getUsers).toEqual([
    //             {
    //                 type: Models.UserModels.userTypes.ADMIN, 
    //                 realName: 'admin', 
    //                 createdBy: 'chon', 
    //                 organisation: 'DSI',
    //                 id: adminId
    //             }
    //         ]);
    //     });

    //     test('Get a specific self user with details (user)', async () => {
    //         const res = await user.post('/graphql').send({ query: print(GET_USERS), variables: { userId, fetchDetailsAdminOnly: true, fetchAccessPrivileges: true } });
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toBeUndefined();
    //         expect(res.body.data.getUsers).toEqual([
    //             {
    //                 username: 'standardUser', 
    //                 type: Models.UserModels.userTypes.STANDARD, 
    //                 realName: 'Chan Tai Man', 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI',
    //                 email: 'standard@user.io', 
    //                 description: 'I am a standard user.',
    //                 id: userId,
    //                 access: {
    //                     id: `user_access_obj_user_id_${userId}`,
    //                     projects: [],
    //                     studies: []
    //                 }
    //             }
    //         ]);
    //     });

    //     test('Get a specific self user without details (w/ access info) (user)', async () => {
    //         const res = await user.post('/graphql').send({ query: print(GET_USERS), variables: { userId, fetchDetailsAdminOnly: false, fetchAccessPrivileges: true } });
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toBeUndefined();
    //         expect(res.body.data.getUsers).toEqual([
    //             {
    //                 type: Models.UserModels.userTypes.STANDARD, 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI',
    //                 realName: 'Chan Tai Man',
    //                 id: userId,
    //                 access: {
    //                     id: `user_access_obj_user_id_${userId}`,
    //                     projects: [],
    //                     studies: []
    //                 }
    //             }
    //         ]);
    //     });
    // });

    describe('APP USER MUTATION API', () => {
        let adminId;
        let userId;

        beforeAll(async () => {
            /* setup: first retrieve the generated user id */
            const result = await mongoClient
                .collection(config.database.collections.users_collection)
                .find({}, { projection: { id: 1, username: 1 } })
                .toArray();
            adminId = result.filter(e => e.username === 'admin')[0].id;
            userId = result.filter(e => e.username === 'standardUser')[0].id;
        });

        test('create user (admin)', async () => {
            const res = await admin.post('/graphql').send({
                query: print(CREATE_USER),
                variables: {
                    username: 'testuser1',
                    password: 'testpassword',
                    realName: 'User Testing',
                    description: 'I am fake!',
                    organisation: 'DSI-ICL',
                    emailNotificationsActivated: false,
                    email: 'fake@email.io',
                    type: Models.UserModels.userTypes.STANDARD,
                    createdAt: "11111111"
                }
            });
            console.log(res.body.data.createUser);
            /* getting the id of the created user from mongo */
            const createdUserId = (await mongoClient
                .collection(config.database.collections.users_collection)
                .findOne({ username: 'testuser1' }, { projection: { id: 1 } })).id;

            expect(res.status).toBe(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.createUser).toEqual(
                {
                    username: 'testuser1', 
                    type: Models.UserModels.userTypes.STANDARD, 
                    realName: 'User Testing', 
                    createdBy: 'admin', 
                    organisation: 'DSI-ICL',
                    email: 'fake@email.io', 
                    description: 'I am fake!',
                    id: createdUserId,
                    access: {
                        id: `user_access_obj_user_id_${createdUserId}`,
                        projects: [],
                        studies: []
                    },
                    createdAt: "11111111"
                }
            )
        });

    //     test('create user with wrong email format (admin)', async () => {
    //         const res = await admin.post('/graphql').send({
    //             query: print(CREATE_USER),
    //             variables: {
    //                 username: 'testuser2',
    //                 password: 'testpassword',
    //                 realName: 'User Testing2',
    //                 description: 'I am fake!',
    //                 organisation: 'DSI-ICL',
    //                 emailNotificationsActivated: false,
    //                 email: 'fak@e@semail.io',
    //                 type: Models.UserModels.userTypes.STANDARD
    //             }
    //         });
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(1);
    //         expect(res.body.errors[0].message).toBe('Email is not the right format.');
    //         expect(res.body.data.createUser).toBe(null);
    //     });

    //     test('create user with space in password and username (admin)', async () => {
    //         const res = await admin.post('/graphql').send({
    //             query: print(CREATE_USER),
    //             variables: {
    //                 username: 'test user1',
    //                 password: 'test password',
    //                 realName: 'User Testing',
    //                 description: 'I am fake!',
    //                 organisation: 'DSI-ICL',
    //                 emailNotificationsActivated: false,
    //                 email: 'fake@email.io',
    //                 type: Models.UserModels.userTypes.STANDARD
    //             }
    //         });
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(1);
    //         expect(res.body.errors[0].message).toBe('Username or password cannot have space.');
    //         expect(res.body.data.createUser).toBe(null);
    //     });

    //     test('create user (user)', async () => {
    //         const res = await user.post('/graphql').send({
    //             query: print(CREATE_USER),
    //             variables: {
    //                 username: 'testuser1',
    //                 password: 'testpassword',
    //                 realName: 'User Testing',
    //                 description: 'I am fake!',
    //                 organisation: 'DSI-ICL',
    //                 emailNotificationsActivated: false,
    //                 email: 'fake@email.io',
    //                 type: Models.UserModels.userTypes.STANDARD
    //             }
    //         });

    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(1);
    //         expect(res.body.errors[0].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.data.createUser).toEqual(null);
    //     });

    //     test('create user that already exists (admin)', async () => {
    //         /* setup: getting the id of the created user from mongo */
    //         const newUser = {
    //             username : 'new_user', 
    //             type: 'STANDARD', 
    //             realName: 'Chan Siu Man', 
    //             password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi', 
    //             createdBy: 'admin', 
    //             email: 'new@user.io', 
    //             description: 'I am a new user.',
    //             emailNotificationsActivated: true, 
    //             organisation:  'DSI',
    //             deleted: null, 
    //             id: 'replaced_at_runtime1',
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

    //         /* assertions */
    //         const res = await admin.post('/graphql').send({
    //             query: print(CREATE_USER),
    //             variables: {
    //                 username: 'new_user',
    //                 password: 'testpassword',
    //                 realName: 'User Testing',
    //                 description: 'I am fake!',
    //                 organisation: 'DSI-ICL',
    //                 emailNotificationsActivated: false,
    //                 email: 'fake@email.io',
    //                 type: Models.UserModels.userTypes.STANDARD
    //             }
    //         });
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(1);
    //         expect(res.body.errors[0].message).toBe('User already exists.');
    //         expect(res.body.data.createUser).toBe(null);
    //     });

    //     test('create user that already exists (user) (should fail)', async () => {
    //         /* setup: getting the id of the created user from mongo */
    //         const newUser = {
    //             username : 'new_user_2', 
    //             type: 'STANDARD', 
    //             realName: 'Chan Ming', 
    //             password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi', 
    //             createdBy: 'admin', 
    //             email: 'new2@user.io', 
    //             description: 'I am a new user 2.',
    //             emailNotificationsActivated: true, 
    //             organisation:  'DSI',
    //             deleted: null, 
    //             id: 'fakeid1',
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

    //         /* assertions */
    //         const res = await user.post('/graphql').send({
    //             query: print(CREATE_USER),
    //             variables: {
    //                 username: 'new_user',
    //                 password: 'testpassword',
    //                 realName: 'User Testing',
    //                 description: 'I am fake!',
    //                 organisation: 'DSI-ICL',
    //                 emailNotificationsActivated: false,
    //                 email: 'fake@email.io',
    //                 type: Models.UserModels.userTypes.STANDARD
    //             }
    //         });
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(1);
    //         expect(res.body.errors[0].message).toBe('NO_PERMISSION_ERROR');
    //         expect(res.body.data.createUser).toBe(null);
    //     });


    //     test('edit user (admin)', async () => {
    //         /* setup: getting the id of the created user from mongo */
    //         const newUser = {
    //             username : 'new_user_3', 
    //             type: 'STANDARD', 
    //             realName: 'Chan Ming Man', 
    //             password: 'fakepassword', 
    //             createdBy: 'admin', 
    //             email: 'new3@user.io', 
    //             description: 'I am a new user 3.',
    //             emailNotificationsActivated: true, 
    //             organisation:  'DSI',
    //             deleted: null, 
    //             id: 'fakeid2',
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

    //         /* assertion */
    //         const res = await admin.post('/graphql').send(
    //             {
    //                 query: print(EDIT_USER),
    //                 variables: {
    //                     id: 'fakeid2',
    //                     password: 'admin',
    //                     username: 'fakeusername',
    //                     type: Models.UserModels.userTypes.ADMIN,
    //                     realName: 'Man',
    //                     email: 'hey@uk.io',
    //                     description: 'DSI director',
    //                     organisation: 'DSI-ICL',
    //                 }
    //             }
    //         );
    //         const result = await mongoClient
    //             .collection(config.database.collections.users_collection)
    //             .findOne({ id: 'fakeid2' });
    //         expect(result.password).not.toBe('fakepassword');
    //         expect(result.password).toHaveLength(60);
    //         expect(res.status).toBe(200);
    //         expect(res.body.data.editUser).toEqual(
    //             {

    //                 username: 'fakeusername', 
    //                 type: Models.UserModels.userTypes.ADMIN, 
    //                 realName: 'Man', 
    //                 createdBy: 'admin', 
    //                 organisation: 'DSI-ICL',
    //                 email: 'hey@uk.io', 
    //                 description: 'DSI director',
    //                 id: 'fakeid2',
    //                 access: {
    //                     id: `user_access_obj_user_id_fakeid2`,
    //                     projects: [],
    //                     studies: []
    //                 }
    //             }
    //         );
    //     });

    //     test('edit own password (user)', async () => {
    //         /* setup: getting the id of the created user from mongo */
    //         const newUser = {
    //             username : 'new_user_4', 
    //             type: 'STANDARD', 
    //             realName: 'Ming Man', 
    //             password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi', 
    //             createdBy: 'admin', 
    //             email: 'new4@user.io', 
    //             description: 'I am a new user 4.',
    //             emailNotificationsActivated: true, 
    //             organisation:  'DSI',
    //             deleted: null, 
    //             id: 'fakeid4',
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);
    //         const createdUser = request.agent(app);
    //         await connectAgent(createdUser, 'new_user_4', 'admin');

    //         /* assertion */
    //         const res = await createdUser.post('/graphql').send(
    //             {
    //                 query: print(EDIT_USER),
    //                 variables: {
    //                     id: 'fakeid4',
    //                     password: 'admin',
    //                     email: 'new_email@ic.ac.uk'
    //                 }
    //             }
    //         );
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toBeUndefined();
    //         expect(res.body.data.editUser).toEqual({
    //             username: 'new_user_4',
    //             type: Models.UserModels.userTypes.STANDARD,
    //             realName: 'Ming Man',
    //             createdBy: 'admin',
    //             organisation: 'DSI',
    //             email: 'new_email@ic.ac.uk',
    //             description: 'I am a new user 4.',
    //             id: 'fakeid4',
    //             access: {
    //                 id: 'user_access_obj_user_id_fakeid4',
    //                 projects: [],
    //                 studies: []
    //             }
    //         });
    //     });

    //     test('edit own non-password fields (user) (should fail)', async () => {
    //         /* setup: getting the id of the created user from mongo */
    //         const newUser = {
    //             username : 'new_user_5',
    //             type: 'STANDARD',
    //             realName: 'Ming Man Chon',
    //             password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi', 
    //             createdBy: 'admin',
    //             email: 'new5@user.io',
    //             description: 'I am a new user 5.',
    //             emailNotificationsActivated: true,
    //             organisation:  'DSI',
    //             deleted: null,
    //             id: 'fakeid5'
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);
    //         const createdUser = request.agent(app);
    //         await connectAgent(createdUser, 'new_user_5', 'admin');

    //         /* assertion */
    //         const res = await createdUser.post('/graphql').send(
    //             {
    //                 query: print(EDIT_USER),
    //                 variables: {
    //                     id: 'fakeid5',
    //                     username: 'new_username',
    //                     type: 'ADMIN',
    //                     realName: 'Ming Man Chon',
    //                     description: 'I am a new user 5.'
    //                 }
    //             }
    //         );
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(1);
    //         expect(res.body.errors[0].message).toBe('User not updated: Non-admin users are only authorised to change their password or email.');
    //         expect(res.body.data.editUser).toEqual(null);
    //     });

    //     test('edit own email with malformed email (user) (should fail)', async () => {
    //         /* setup: getting the id of the created user from mongo */
    //         const newUser = {
    //             username : 'new_user_6',
    //             type: 'STANDARD',
    //             realName: 'Ming Man',
    //             password: '$2b$04$j0aSK.Dyq7Q9N.r6d0uIaOGrOe7sI4rGUn0JNcaXcPCv.49Otjwpi',
    //             createdBy: 'admin',
    //             email: 'new6@user.io',
    //             description: 'I am a new user 6.',
    //             emailNotificationsActivated: true,
    //             organisation:  'DSI',
    //             deleted: null,
    //             id: 'fakeid6'
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);
    //         const createdUser = request.agent(app);
    //         await connectAgent(createdUser, 'new_user_6', 'admin');

    //         /* assertion */
    //         const res = await createdUser.post('/graphql').send(
    //             {
    //                 query: print(EDIT_USER),
    //                 variables: {
    //                     id: 'fakeid6',
    //                     email: 'new_@email@ic.ac.uk'
    //                 }
    //             }
    //         );
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(1);
    //         expect(res.body.errors[0].message).toBe('User not updated: Email is not the right format.');
    //         expect(res.body.data.editUser).toBe(null);
    //     });

    //     test('edit other user (user)', async () => {
    //         /* setup: getting the id of the created user from mongo */
    //         const newUser = {
    //             username : 'new_user_7',
    //             type: 'STANDARD',
    //             realName: 'Ming Man Tai',
    //             password: 'fakepassword',
    //             createdBy: 'admin',
    //             email: 'new7@user.io',
    //             description: 'I am a new user 7.',
    //             emailNotificationsActivated: true,
    //             organisation:  'DSI',
    //             deleted: null,
    //             id: 'fakeid7'
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

    //         /* assertion */
    //         const res = await user.post('/graphql').send(
    //             {
    //                 query: print(EDIT_USER),
    //                 variables: {
    //                     id: 'fakeid7',
    //                     password: 'email'
    //                 }
    //             }
    //         );
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(1);
    //         expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
    //         expect(res.body.data.editUser).toEqual(null);
    //     });

    //     test('delete user (admin)', async () => {
    //         /* setup: create a new user to be deleted */
    //         const newUser = {
    //             username : 'new_user_8',
    //             type: 'STANDARD',
    //             realName: 'Chan Mei',
    //             password: 'fakepassword',
    //             createdBy: 'admin',
    //             email: 'new8@user.io',
    //             description: 'I am a new user 8.',
    //             emailNotificationsActivated: true,
    //             organisation:  'DSI',
    //             deleted: null,
    //             id: 'fakeid8'
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

    //         /* assertion */
    //         const getUserRes = await admin.post('/graphql').send({
    //             query: print(GET_USERS),
    //             variables: { userId: newUser.id, fetchDetailsAdminOnly: false, fetchAccessPrivileges: false }
    //         });

    //         expect(getUserRes.body.data.getUsers).toEqual([{
    //             realName: 'Chan Mei',
    //             type: Models.UserModels.userTypes.STANDARD,
    //             createdBy: 'admin',
    //             organisation: 'DSI',
    //             id: newUser.id
    //         }]);


    //         const res = await admin.post('/graphql').send(
    //             {
    //                 query: print(DELETE_USER),
    //                 variables: {
    //                     userId: newUser.id
    //                 }
    //             }
    //         );
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toBeUndefined();
    //         expect(res.body.data.deleteUser).toEqual({
    //             successful: true,
    //             id: newUser.id
    //         });

    //         const getUserResAfter = await admin.post('/graphql').send({
    //             query: print(GET_USERS),
    //             variables: { userId: newUser.id, fetchDetailsAdminOnly: false, fetchAccessPrivileges: false }
    //         });

    //         expect(getUserResAfter.body.data.getUsers).toEqual([]);
    //     });

    //     test('delete user that has been deleted (admin)', async () => {
    //         /* setup: create a "deleted" new user to be deleted */
    //         const newUser = {
    //             username : 'new_user_9', 
    //             type: 'STANDARD', 
    //             realName: 'Chan Mei Fong', 
    //             password: 'fakepassword', 
    //             createdBy: 'admin', 
    //             email: 'new9@user.io', 
    //             description: 'I am a new user 9.',
    //             emailNotificationsActivated: true, 
    //             organisation:  'DSI',
    //             deleted: (new Date()).valueOf(), 
    //             id: 'fakeid9',
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

    //         /* assertions */
    //         const res = await admin.post('/graphql').send(
    //             {
    //                 query: print(DELETE_USER),
    //                 variables: {
    //                     userId: newUser.id
    //                 }
    //             }
    //         );
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toBeUndefined();
    //         expect(res.body.data.deleteUser).toEqual({
    //             successful: true,
    //             id: newUser.id
    //         });
    //     });

    //     test('delete user that has never existed (admin)', async () => {
    //         const res = await admin.post('/graphql').send(
    //             {
    //                 query: print(DELETE_USER),
    //                 variables: {
    //                     userId: 'I never existed' 
    //                 }
    //             }
    //         );
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toBeUndefined();
    //         expect(res.body.data.deleteUser).toEqual({
    //             successful: true,
    //             id: 'I never existed'
    //         });
    //     });

    //     test('delete user (user)', async () => {
    //         /* setup: create a new user to be deleted */
    //         const newUser = {
    //             username : 'new_user_10', 
    //             type: 'STANDARD', 
    //             realName: 'Chan Mei Yi', 
    //             password: 'fakepassword', 
    //             createdBy: 'admin', 
    //             email: 'new10@user.io', 
    //             description: 'I am a new user 10.',
    //             emailNotificationsActivated: true, 
    //             organisation:  'DSI',
    //             deleted: null, 
    //             id: 'fakeid10',
    //         };
    //         await mongoClient.collection(config.database.collections.users_collection).insertOne(newUser);

    //         /* assertion */
    //         const getUserRes = await user.post('/graphql').send({
    //             query: print(GET_USERS),
    //             variables: { userId: newUser.id, fetchDetailsAdminOnly: false, fetchAccessPrivileges: false }
    //         });

    //         expect(getUserRes.body.data.getUsers).toEqual([{
    //             realName: 'Chan Mei Yi',
    //             type: Models.UserModels.userTypes.STANDARD, 
    //             createdBy: 'admin', 
    //             organisation: 'DSI',
    //             id: newUser.id,
    //         }]);


    //         const res = await user.post('/graphql').send(
    //             {
    //                 query: print(DELETE_USER),
    //                 variables: {
    //                     userId: newUser.id
    //                 }
    //             }
    //         );
    //         expect(res.status).toBe(200);
    //         expect(res.body.errors).toHaveLength(1);
    //         expect(res.body.errors[0].message).toBe(errorCodes.NO_PERMISSION_ERROR);
    //         expect(res.body.data.deleteUser).toEqual(null);

    //         const getUserResAfter = await user.post('/graphql').send({
    //             query: print(GET_USERS),
    //             variables: { userId: newUser.id, fetchDetailsAdminOnly: false, fetchAccessPrivileges: false }
    //         });

    //         expect(getUserResAfter.body.data.getUsers).toEqual([{
    //             realName: 'Chan Mei Yi',
    //             type: Models.UserModels.userTypes.STANDARD, 
    //             createdBy: 'admin', 
    //             organisation: 'DSI',
    //             id: newUser.id,
    //         }]);
    //     });
    });
});
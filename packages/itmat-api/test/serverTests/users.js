'use strict';

const request = require('supertest');
const { APIServer } = require('../../dist/src/server/server');
const config = require('../../config/config.test');
// const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;

// // const server = new APIServer(config);

let mongod;
let server;
let app;
let adminSessionCookie;
let standardSessionCookie;


beforeAll(async () => {
    // mongod = new MongoMemoryServer();
    // const mongoUri = await mongod.getConnectionString();
    // const dbName = await mongod.getDbName();
    // config.database.mongo_url = mongoUri;
    // config.database.database = dbName;
    server = new APIServer(config);
    app = await server.initialise();
});

// afterAll(() => {
//     mongod.stop();
// });

describe('Server - Users API', () => {
    test('whoAmI (not logged in)', () =>
        request(app)
            .get('/whoAmI')
            .then(res => {
                expect(res.status).toBe(403);
                expect(res.body).toEqual({ message: 'A unicorn, whose multitude is denominated a blessing, and which is Scotland\'s national animal.' });
                return true;
            })
    );

    test('login as admin with wrong password (should fail)', () =>
        request(app)
            .post('/login')
            .send({ username: 'admin', password: 'standard' })
            .then(res => {
                expect(res.status).toBe(401);
                return true;
            })
    );

    test('login as admin', () =>
        request(app)
            .post('/login')
            .send({ password: 'admin', username: 'admin' })
            .then(res => {
                adminSessionCookie = res.header['set-cookie'];
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'Logged in!' });
                return true;
            })
    );

    test('whoAmI as admin', () =>
        request(app)
            .get('/whoAmI')
            .set('Cookie', adminSessionCookie)
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ createdBy: 'me!', type: 'ADMIN', username: 'admin' });
                return true;
            })
    );

    test('get all users as admin', () =>
        request(app)
            .get('/users')
            .set('Cookie', adminSessionCookie)
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual([{ deleted: false, type: 'ADMIN', username: 'admin' }]);
                return true;
            })
    );

    test('create an user as admin but with invalid type (should fail)', () =>
        request(app)
            .post('/users')
            .set('Cookie', adminSessionCookie)
            .send({ username: 'test', password: 'test', type: 'NOTVALID!' })
            .then(res => {
                expect(res.status).toBe(400);
                expect(res.body).toEqual({ error: true, message: 'Invalid value for key \'type\'. Valid value(s): ADMIN,STANDARD' });
                return true;
            })
    );

    test('create an user as admin but with missing fields (should fail)', () =>
        request(app)
            .post('/users')
            .set('Cookie', adminSessionCookie)
            .send({ password: 'test', type: 'STANDARD' })
            .then(res => {
                expect(res.status).toBe(400);
                expect(res.body).toEqual({ error: true, message: 'A body object with key(s) \'username,password,type\' are expected. Please check API doc.' });
                return true;
            })
    );

    test('create an user as admin', () =>
        request(app)
            .post('/users')
            .set('Cookie', adminSessionCookie)
            .send({ username: 'test', password: 'test', type: 'STANDARD' })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'Created user test' });
                return true;
            })
    );

    test('create an user as admin', () =>
        request(app)
            .post('/users')
            .set('Cookie', adminSessionCookie)
            .send({ username: 'test', password: 'test', type: 'STANDARD' })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'Created user test' });
                return true;
            })
    );

    test('get all users as admin now that there is a new user', () =>
        request(app)
            .get('/users')
            .set('Cookie', adminSessionCookie)
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual([{ deleted: false, type: 'ADMIN', username: 'admin' }, { deleted: false, type: 'STANDARD', username: 'test' }]);
                return true;
            })
    );

    test('getting a specific user', () =>
        request(app)
            .get('/users?username=test')
            .set('Cookie', adminSessionCookie)
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ createdBy: 'admin', type: 'STANDARD', username: 'test' });
                return true;
            })
    );

    test('getting a specific user that doesnt exist', () =>
        request(app)
            .get('/users?username=teddddfsst')
            .set('Cookie', adminSessionCookie)
            .then(res => {
                expect(res.status).toBe(404);
                expect(res.body).toEqual({ error: true, message: 'user not found' });
                return true;
            })
    );

    test('login as standard user', () =>
        request(app)
            .post('/login')
            .send({ password: 'test', username: 'test' })
            .then(res => {
                standardSessionCookie = res.header['set-cookie'];
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'Logged in!' });
                return true;
            })
    );

    test('create an user as standard user (should fail)', () =>
        request(app)
            .post('/users')
            .set('Cookie', standardSessionCookie)
            .send({ username: 'test', password: 'test', type: 'STANDARD' })
            .then(res => {
                expect(res.status).toBe(401);
                expect(res.body).toEqual({ error: true, message: 'You are not authorised to be doing this request.' });
                return true;
            })
    );

    test('get users as standard user (should fail)', () =>
        request(app)
            .get('/users')
            .set('Cookie', standardSessionCookie)
            .then(res => {
                expect(res.status).toBe(401);
                expect(res.body).toEqual({ error: true, message: 'You are not authorised to be doing this request.' });
                return true;
            })
    );

    test('standard user trying to change his privilege to admin (should fail)', () =>
        request(app)
            .patch('/users')
            .set('Cookie', standardSessionCookie)
            .send({ user: 'test', type: 'ADMIN' })
            .then(res => {
                expect(res.status).toBe(401);
                expect(res.body).toEqual({ error: true, message: 'Non-admin users are not authorised to change user type.' });
                return true;
            })
    );

    test('standard user changes his username', () =>
        request(app)
            .patch('/users')
            .set('Cookie', standardSessionCookie)
            .send({ user: 'test', type: 'ADMIN' })
            .then(res => {
                expect(res.status).toBe(401);
                expect(res.body).toEqual({ error: true, message: 'Non-admin users are not authorised to change user type.' });
                return true;
            })
    );

    test('standard user doesnt provide anything to update', () =>
        request(app)
            .patch('/users')
            .set('Cookie', standardSessionCookie)
            .send({ user: 'test' })
            .then(res => {
                expect(res.status).toBe(400);
                expect(res.body).toEqual({ error: true, message: 'Did not provide any field to update.' });
                return true;
            })
    );

    test('standard user updates his password', () =>
        request(app)
            .patch('/users')
            .set('Cookie', standardSessionCookie)
            .send({ user: 'test', password: 'tester' })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'User test has been updated.' });
                return true;
            })
    );

    test('standard user updates other peoples password', () =>
        request(app)
            .patch('/users')
            .set('Cookie', standardSessionCookie)
            .send({ user: 'admin', password: 'tester' })
            .then(res => {
                expect(res.status).toBe(401);
                expect(res.body).toEqual({ error: true, message: 'You are not authorised to be doing this request.' });
                return true;
            })
    );

    test('admin user updates other peoples password', () =>
        request(app)
            .patch('/users')
            .set('Cookie', adminSessionCookie)
            .send({ user: 'test', password: 'tester2' })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'User test has been updated.' });
                return true;
            })
    );

    test('standard user logs out other people', () =>
        request(app)
            .patch('/users')
            .set('Cookie', standardSessionCookie)
            .send({ user: 'admin' })
            .then(res => {
                expect(res.status).toBe(401);
                expect(res.body).toEqual({ error: true, message: 'You are not authorised to be doing this request.' });
                return true;
            })
    );

    test('standard user logs out himself', () =>
        request(app)
            .post('/logout')
            .set('Cookie', standardSessionCookie)
            .send({ user: 'test' })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'Successfully logged out' });
                return true;
            })
    );

    test('delete an user as admin', () =>
        request(app)
            .delete('/users')
            .set('Cookie', adminSessionCookie)
            .send({ user: 'test' })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'User test has been deleted.' });
                return true;
            })
    );

    test('admin user logs out himself', () =>
        request(app)
            .post('/logout')
            .set('Cookie', adminSessionCookie)
            .send({ user: 'admin' })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body).toEqual({ message: 'Successfully logged out' });
                return true;
            })
    );
});
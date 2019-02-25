const request = require('supertest');
const admin = request.agent(global._APP_);
const user = request.agent(global._APP_);
const { connectAdmin, connectUser } = require('./loginHelper');
const { GET_SPECIFIC_USER, GET_USERS_LIST, CREATE_USER, EDIT_USER, DELETE_USER } = require('./gql/appUsersGql');

beforeAll(async () => { //eslint-disable-line no-undef
    await connectAdmin(admin);
    await connectUser(user);
});

describe('APP USERS API', () => {
    test('Get all users (admin)',  () => admin
        .post('/graphql')
        .send({ query: GET_USERS_LIST })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('Get all users (user)',  () => user
        .post('/graphql')
        .send({ query: GET_USERS_LIST })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('Get a specific user (admin)',  () => admin
        .post('/graphql')
        .send({ query: GET_SPECIFIC_USER, variables: { username: 'chon' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('Get a specific non-self user (user)',  () => user
        .post('/graphql')
        .send({ query: GET_SPECIFIC_USER, variables: { username: 'admin' }})
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('Get a specific self user (user)',  () => user
        .post('/graphql')
        .send({ query: GET_SPECIFIC_USER, variables: { username: 'admin' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));











    test('create user (admin)',  () => admin
        .post('/graphql')
        .send({ query: CREATE_USER, variables: { username: 'chon' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('create user (user)',  () => user
        .post('/graphql')
        .send({ query: CREATE_USER, variables: { username: 'admin' }})
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('create user that already exists (admin)',  () => admin
        .post('/graphql')
        .send({ query: CREATE_USER, variables: { username: 'chon' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('create user that already exists (user)',  () => user
        .post('/graphql')
        .send({ query: CREATE_USER, variables: { username: 'admin' }})
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));


    test('edit user (admin)',  () => admin
        .post('/graphql')
        .send({ query: EDIT_USER, variables: { username: 'chon' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('edit user (user)',  () => user
        .post('/graphql')
        .send({ query: EDIT_USER, variables: { username: 'admin' }})
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('delete user (user)',  () => user
        .post('/graphql')
        .send({ query: DELETE_USER, variables: { username: 'admin' }})
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('delete user (admin)',  () => admin
        .post('/graphql')
        .send({ query: DELETE_USER, variables: { username: 'chon' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('delete user that has been deleted (admin)',  () => admin
        .post('/graphql')
        .send({ query: DELETE_USER, variables: { username: 'chon' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('delete user that has been deleted (user)',  () => admin
        .post('/graphql')
        .send({ query: DELETE_USER, variables: { username: 'chon' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('delete user that has never existed (admin)',  () => admin
        .post('/graphql')
        .send({ query: DELETE_USER, variables: { username: 'chon' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('delete user that has never existed (user)',  () => admin
        .post('/graphql')
        .send({ query: DELETE_USER, variables: { username: 'chon' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));


    
});
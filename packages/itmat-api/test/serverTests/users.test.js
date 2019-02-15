const request = require('supertest');
const admin = request.agent(global._APP_);
const user = request.agent(global._APP_);
const { connectAdmin, connectUser, disconnectAgent } = require('./loginHelper');
const { WHO_AM_I, ADD_SHORT_CUT } = require('./gql/usersGql');

beforeAll(async () => { //eslint-disable-line no-undef
    await connectAdmin(admin);
    await connectUser(user);
});


describe('USERS API', () => {
    test('Who am I (admin)',  () => admin
        .post('/graphql')
        .send({ query: WHO_AM_I })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.whoAmI.username).toBe('admin');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('Who am I (user)', () => user
        .post('/graphql')
        .send({ query: WHO_AM_I })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.whoAmI.username).toBe('chon');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('Add shortcut (study + application) (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_SHORT_CUT, variables: { study: 'study001', application: 'youtube' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.addShortCut.username).toBe('admin');
            expect(res.body.data.addShortCut.shortcuts.length).toBe(1);
            expect(res.body.data.addShortCut.shortcuts[0].study).toBe('study001');
            expect(res.body.data.addShortCut.shortcuts[0].application).toBe('youtube');
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('Add shortcut (study) (user)', () => user
        .post('/graphql')
        .send({ query: ADD_SHORT_CUT, variables: { study: 'study001' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.addShortCut.username).toBe('chon');
            expect(res.body.data.addShortCut.shortcuts.length).toBe(1);
            expect(res.body.data.addShortCut.shortcuts[0].study).toBe('study001');
            expect(res.body.data.addShortCut.shortcuts[0].application).toBe(null);
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('Add shortcut (study) (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_SHORT_CUT, variables: { study: 'study001', application: 'youtube' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.addShortCut.username).toBe('admin');
            expect(res.body.data.addShortCut.shortcuts.length).toBe(2);
            expect(res.body).toMatchSnapshot();
            return true;
    }));

    test('Add shortcut (study + application) (user)', () => user
        .post('/graphql')
        .send({ query: ADD_SHORT_CUT, variables: { study: 'study001' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.addShortCut.username).toBe('chon');
            expect(res.body.data.addShortCut.shortcuts.length).toBe(2);
            expect(res.body).toMatchSnapshot();
            return true;
    }));

});
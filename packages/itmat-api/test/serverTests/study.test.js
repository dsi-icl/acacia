const request = require('supertest');
const admin = request.agent(global._APP_);
const user = request.agent(global._APP_);
const { connectAdmin, connectUser, disconnectAgent } = require('./loginHelper');
const { GET_APPLICATION, GET_STUDIES_LIST, CREATE_APPLICATION, CREATE_STUDY } = require('./gql/studyGql');

beforeAll(async () => { //eslint-disable-line no-undef
    await connectAdmin(admin);
    await connectUser(user);
});

let studyId;

describe('STUDY API', () => {
    test('Get studies when there is none (admin)',  () => admin
        .post('/graphql')
        .send({ query: GET_STUDIES_LIST })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.getStudies).toEqual([]);
            return true;
    }));

    test('Get studies when there is none (user)',  () => user
        .post('/graphql')
        .send({ query: GET_STUDIES_LIST })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.getStudies).toEqual([]);
            return true;
    }));

    test('Get studies when there is none (admin)',  () => admin
        .post('/graphql')
        .send({ query: GET_STUDIES_LIST, variables: { name: 'studyThatDoesntExist' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.getStudies).toEqual([]);
            return true;
    }));

    test('Get studies when there is none (user)',  () => user
        .post('/graphql')
        .send({ query: GET_STUDIES_LIST, variables: { name: 'studyThatDoesntExist' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.getStudies).toEqual([]);
            return true;
    }));

    test('Create study (admin)',  () => admin
        .post('/graphql')
        .send({ query: CREATE_STUDY, variables: { name: 'Study001', isUkbiobank: false } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createStudy.id).toBeDefined();
            studyId = res.body.data.createStudy.id;
            expect(typeof res.body.data.createStudy.id).toBe('string');
            expect(res.body.data.createStudy.name).toBe('Study001');
            return true;
    }));

    // test('Create study that violate unique name constraint (admin)',  () => admin
    //     .post('/graphql')
    //     .send({ query: CREATE_STUDY, variables: { name: 'Study001', isUkbiobank: false } })
    //     .then(res => {
    //         expect(res.status).toBe(400);
    //         return true;
    // }));

    test('Create study (user)',  () => user
        .post('/graphql')
        .send({ query: CREATE_STUDY, variables: { name: 'Study002', isUkbiobank: false } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createStudy).toBeNull();
            expect(res.body.errors[0].message).toBe('Unauthorised.');
            expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
            return true;
    }));

    test('Create application (admin)',  () => admin
        .post('/graphql')
        .send({ query: CREATE_APPLICATION, variables: { study: 'Study001', application: 'Application001' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createApplication.id).toBe(studyId);
            expect(res.body.data.createApplication.applications).toBeDefined();
            expect(typeof res.body.data.createApplication.applications[0].id).toBe('string');
            expect(res.body.data.createApplication.applications[0].name).toBe('Application001');
            return true;
    }));

    test('Create application (user not as study manager)',  () => user
        .post('/graphql')
        .send({ query: CREATE_APPLICATION, variables: { study: 'Study001', application: 'Application002' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createApplication).toBeNull();
            expect(res.body.errors[0].message).toBe('Unauthorised.');
            expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
            return true;
    }));

    test('Create application to a non-existent study (admin)',  () => admin
        .post('/graphql')
        .send({ query: CREATE_APPLICATION, variables: { study: 'FakeStudy', application: 'Application003' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createApplication).toBeNull();
            expect(res.body.errors[0].message).toBe('Study does not exist.');
            expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
            return true;
    }));

    test('Create application to a non-existent study (user)',  () => user
        .post('/graphql')
        .send({ query: CREATE_APPLICATION, variables: { study: 'FakeStudy', application: 'Application003' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createApplication).toBeNull();
            expect(res.body.errors[0].message).toBe('Study does not exist.');
            expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
            return true;
    }));


    
});
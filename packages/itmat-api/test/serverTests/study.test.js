const request = require('supertest');
const admin = request.agent(global._APP_);
const user = request.agent(global._APP_);
const { connectAdmin, connectUser, disconnectAgent } = require('./loginHelper');
const { ADD_USER_TO_APPLICATION, GET_APPLICATION, GET_STUDIES_LIST, CREATE_APPLICATION, CREATE_STUDY, DELETE_USER_FROM_APPLICATION } = require('./gql/studyGql');

beforeAll(async () => { //eslint-disable-line no-undef
    await connectAdmin(admin);
    await connectUser(user);
});

let studyId;
let applicationId;

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

    /////////////////////////////////////////////////////////////

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


    test('Get studies (admin)',  () => admin
        .post('/graphql')
        .send({ query: GET_STUDIES_LIST })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.getStudies.length).toBe(1);
            expect(typeof res.body.data.getStudies[0].id).toBe('string');
            delete res.body.data.getStudies[0].id;
            expect(res.body.data.getStudies).toMatchSnapshot();
            return true;
    }));

    test('Get studies (user)',  () => user
        .post('/graphql')
        .send({ query: GET_STUDIES_LIST })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.getStudies).toEqual([]);
            return true;
    }));

    /////////////////////////////////////////////////////////////

    test('Create application (admin)',  () => admin
        .post('/graphql')
        .send({ query: CREATE_APPLICATION, variables: { study: 'Study001', application: 'Application001' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createApplication.id).toBe(studyId);
            expect(res.body.data.createApplication.applications).toBeDefined();
            expect(typeof res.body.data.createApplication.applications[0].id).toBe('string');
            applicationId = res.body.data.createApplication.applications[0].id;
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
            expect(res.body.errors[0].message).toBe('Study does not exist or you do not have authorisation.');
            expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
            return true;
    }));


    // test('Get studies (admin)',  () => admin
    //     .post('/graphql')
    //     .send({ query: GET_STUDIES_LIST })
    //     .then(res => {
    //         expect(res.status).toBe(200);
    //         expect(res.body.data.getStudies.length).toBe(1);
    //         expect(typeof res.body.data.getStudies[0].id).toBe('string');
    //         delete res.body.data.getStudies[0].id;
    //         expect(res.body.data.getStudies).toMatchSnapshot();
    //         return true;
    // }));

    // test('Get studies (user)',  () => user
    //     .post('/graphql')
    //     .send({ query: GET_STUDIES_LIST })
    //     .then(res => {
    //         expect(res.status).toBe(200);
    //         expect(res.body.data.getStudies).toEqual([]);
    //         return true;
    // }));

    /////////////////////////////////////////////////////////////

    test('Add another user to application (user not as study manager)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'Application001', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.errors[0].message).toBe('Study does not exist or you do not have authorisation.');
            expect(res.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
            return true;
    }));

    test('Add a non-existent user to application (user not as study manager)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'fakeUser', study: 'Study001', application: 'Application001', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.errors[0].message).toBe('Study does not exist or you do not have authorisation.');
            expect(res.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
            return true;
    }));


    test('Add another user to application that doesnt exist (user not as study manager)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'FakeApplication', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.errors[0].message).toBe('Study does not exist or you do not have authorisation.');
            expect(res.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
            return true;
    }));

    test('Add another user to application of a study that doesnt exist (user not as study manager)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'FakeStudy', application: 'Application001', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.errors[0].message).toBe('Study does not exist or you do not have authorisation.');
            expect(res.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
            return true;
    }));

    test('Add a non-existent user to application (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'fakeUser', study: 'Study001', application: 'Application001', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.errors[0].message).toBe('User does not exist.');
            expect(res.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
            return true;
    }));

    test('Add another user to application that doesnt exist (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'chon', study: 'Study001', application: 'FakeApplication', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.errors[0].message).toBe('Study does not exist or you do not have authorisation.');
            expect(res.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
            return true;
    }));

    test('Add another user to application of a study that doesnt exist (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'chon', study: 'FakeStudy', application: 'Application001', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.errors[0].message).toBe('Study does not exist or you do not have authorisation.');
            expect(res.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
            return true;
    }));

    test('Add another user to application (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'chon', study: 'Study001', application: 'Application001', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.errors[0].message).toBe('Study does not exist or you do not have authorisation.');
            expect(res.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
            return true;
    }));

    test('Add user to application as APPLICATION_USER (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'chon', study: 'Study001', application: 'Application001', type: 'APPLICATION_USER' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.addUserToApplication.id).toBe(applicationId);
            expect(res.body.data.addUserToApplication.applicationAdmins).toEqual([]);
            expect(res.body.data.addUserToApplication.applicationUsers).toEqual(['chon']);
            return true;
    }));

    // test('Get studies (admin)',  () => admin
    //     .post('/graphql')
    //     .send({ query: GET_STUDIES_LIST })
    //     .then(res => {
    //         expect(res.status).toBe(200);
    //         expect(res.body.data.getStudies.length).toBe(1);
    //         expect(typeof res.body.data.getStudies[0].id).toBe('string');
    //         delete res.body.data.getStudies[0].id;
    //         expect(res.body.data.getStudies).toMatchSnapshot();
    //         return true;
    // }));

    // test('Get studies (user)',  () => user
    //     .post('/graphql')
    //     .send({ query: GET_STUDIES_LIST })
    //     .then(res => {
    //         expect(res.status).toBe(200);
    //         expect(res.body.data.getStudies).toEqual([]);
    //         return true;
    // }));

    /////////////////////////////////////////////////////////////

    test('Create another application for testing later (admin)',  () => admin
        .post('/graphql')
        .send({ query: CREATE_APPLICATION, variables: { study: 'Study001', application: 'Applicationtesting' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createApplication.id).toBe(studyId);
            expect(res.body.data.createApplication.applications).toBeDefined();
            expect(typeof res.body.data.createApplication.applications[0].id).toBe('string');
            applicationId = res.body.data.createApplication.applications[0].id;
            expect(res.body.data.createApplication.applications[0].name).toBe('Application001');
            return true;
    }));

    test('Create new application (user as APPLICATION_USER)',  () => user
        .post('/graphql')
        .send({ query: CREATE_APPLICATION, variables: { study: 'Study001', application: 'Application005' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createApplication).toBeNull();
            expect(res.body.errors[0].message).toBe('Unauthorised.');
            expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
            return true;
    }));

    test('Add another user to application that doesnt exist (user as APPLICATION_USER)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'fakeapplication', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Add another user to application of a study that doesnt exist (user as APPLICATION_USER)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'fakestudy', application: 'Application001', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Add another user that doesnt exist to application (user as APPLICATION_USER)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'fakeuser', study: 'Study001', application: 'Application001', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Add another user to study but to another application which has nothing to do with user  (user as APPLICATION_USER)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'Applicationtesting', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Add another user to application (user as APPLICATION_USER)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'Application001', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Delete user from application (user as APPLICATION_USER)',  () => user
        .post('/graphql')
        .send({ query: DELETE_USER_FROM_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'Application001' } })
        .then(res => {
            return true;
    }));

    /////////////////////////////////////////////////////////////

    test('Add user to application as APPLICATION_ADMIN (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'chon', study: 'Study001', application: 'Application001', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.addUserToApplication.id).toBe(applicationId);
            expect(res.body.data.addUserToApplication.applicationUsers).toEqual([]);
            expect(res.body.data.addUserToApplication.applicationAdmins).toEqual(['chon']);
            return true;
    }));

    test('Get studies (user as APPLICATION_ADMIN)',  () => user
        .post('/graphql')
        .send({ query: GET_STUDIES_LIST })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.getStudies).toEqual([]);
            return true;
    }));

    test('Create new application (user as APPLICATION_ADMIN)',  () => user
        .post('/graphql')
        .send({ query: CREATE_APPLICATION, variables: { study: 'Study001', application: 'Application005' } })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.createApplication).toBeNull();
            expect(res.body.errors[0].message).toBe('Unauthorised.');
            expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
            return true;
    }));

    test('Add another user to application that doesnt exist (user as APPLICATION_ADMIN)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'fakeapplication', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            return true;
    }));

    test('Add another user to application of a study that doesnt exist (user as APPLICATION_ADMIN)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'fakestudy', application: 'Application001', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            return true;
    }));

    test('Add another user to study but to another application which has nothing to do with user  (user as APPLICATION_ADMIN)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'applicationtesting', type: 'APPLICATION_ADMIN' } })
        .then(res => {
            return true;
    }));

    test('Add another user that doesnt exist to application (user as APPLICATION_USER)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'fakeuser', study: 'Study001', application: 'Application001', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Add another user to application (user as APPLICATION_ADMIN)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'Application001', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Delete user from application (user as APPLICATION_ADMIN)',  () => user
        .post('/graphql')
        .send({ query: DELETE_USER_FROM_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'Application001' } })
        .then(res => {
            return true;
    }));

    test('Delete user from application (admin)',  () => admin
        .post('/graphql')
        .send({ query: DELETE_USER_FROM_APPLICATION, variables: { username: 'chon', study: 'Study001', application: 'Application001' } })
        .then(res => {
            return true;
    }));

    /////////////////////////////////////////////////////////////

    test('Add user to study manager of a study that doesnt exist (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_USER_TO_STUDY_MANAGERS, variables: { username: 'chon', study: 'fakeStudy' } })
        .then(res => {
            return true;
    }));

    test('Add user to study manager of a study (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_USER_TO_STUDY_MANAGERS, variables: { username: 'chon', study: 'Study001' } })
        .then(res => {
            return true;
    }));

    test('Get studies (user as study manager)',  () => user
        .post('/graphql')
        .send({ query: GET_STUDIES_LIST })
        .then(res => {
            expect(res.status).toBe(200);
            expect(res.body.data.getStudies).toEqual([]);
            return true;
    }));

    test('Add user to study manager of a study when he already is there (admin)',  () => admin
        .post('/graphql')
        .send({ query: ADD_USER_TO_STUDY_MANAGERS, variables: { username: 'chon', study: 'fakeStudy' } })
        .then(res => {
            return true;
    }));

    test('What the database actually looks like',  () => admin
        .post('/graphql')
        .send({ })
        .then(res => {
            return true;
    }));

    test('Create new application (user as study manager)',  () => user
        .post('/graphql')
        .send({ query: CREATE_APPLICATION, variables: { study: 'Study001', application: 'newApplication' } })
        .then(res => {
            return true;
    }));

    test('Add another user to application that doesnt exist (user as study manager)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'fakeapplication', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Add another user to application of a study that doesnt exist (user as study manager)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'fakeStudy', application: 'fakeapplication', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Add another user to application (user as study manager)',  () => user
        .post('/graphql')
        .send({ query: ADD_USER_TO_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'application001', type: 'APPLICATION_USER' } })
        .then(res => {
            return true;
    }));

    test('Delete user from application (user as study manager)',  () => user
        .post('/graphql')
        .send({ query: DELETE_USER_FROM_APPLICATION, variables: { username: 'admin', study: 'Study001', application: 'Application001' } })
        .then(res => {
            return true;
    }));
    
});
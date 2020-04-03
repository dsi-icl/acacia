const request = require('supertest');
const { print } = require('graphql');

const admin = request.agent(global._APP_);
const user = request.agent(global._APP_);
const itmatCommons = require('@itmat/commons');
const { connectAdmin, connectUser, disconnectAgent } = require('./_loginHelper');

const {
    ADD_USER_TO_PROJECT, GET_PROJECT, GET_STUDIES_LIST, CREATE_PROJECT, CREATE_STUDY, DELETE_USER_FROM_PROJECT,
} = itmatCommons;

beforeAll(async () => { // eslint-disable-line no-undef
    await connectAdmin(admin);
    await connectUser(user);
});

let studyId;
let projectId;

describe('STUDY API', () => {
    describe('MANIPULATING STUDIES EXISTENCE', () => {
        test('Get studies when there is none (admin)', () => admin
            .post('/graphql')
            .send({ query: GET_STUDIES_LIST })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.getStudies).toEqual([]);
                return true;
            }));

        test('Get studies when there is none (user)', () => user
            .post('/graphql')
            .send({ query: GET_STUDIES_LIST })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.getStudies).toEqual([]);
                return true;
            }));

        test('Get studies when there is none (admin)', () => admin
            .post('/graphql')
            .send({ query: GET_STUDIES_LIST, variables: { name: 'studyThatDoesntExist' } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.getStudies).toEqual([]);
                return true;
            }));

        test('Get studies when there is none (user)', () => user
            .post('/graphql')
            .send({ query: GET_STUDIES_LIST, variables: { name: 'studyThatDoesntExist' } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.getStudies).toEqual([]);
                return true;
            }));

        test('Create study (admin)', () => admin
            .post('/graphql')
            .send({ query: CREATE_STUDY, variables: { name: 'Study001', isUkbiobank: false } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.createStudy.id).toBeDefined();
                studyId = res.body.data.createStudy.id;
                expect(typeof res.body.data.createStudy.id).toBe('string');
                expect(res.body.data.createStudy.name).toBe('Study001');
                return true;
            }));

        test('Create study that violate unique name constraint (admin)', () => admin
            .post('/graphql')
            .send({ query: CREATE_STUDY, variables: { name: 'Study001', isUkbiobank: false } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.error).toBeDefined();
                expect(res.body.data.createStudy).toBeNull();
                return true;
            }));

        test('Create study (user)', () => user
            .post('/graphql')
            .send({ query: CREATE_STUDY, variables: { name: 'Study002', isUkbiobank: false } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.createStudy).toBeNull();
                expect(res.body.errors[0].message).toBe('Unauthorised.');
                expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
                return true;
            }));


        test('Get studies (admin)', () => admin
            .post('/graphql')
            .send({ query: GET_STUDIES_LIST })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.getStudies.length).toBe(1);
                expect(typeof res.body.data.getStudies[0].id).toBe('string');
                return true;
            }));

        test('Get studies (user)', () => user
            .post('/graphql')
            .send({ query: GET_STUDIES_LIST })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.getStudies).toEqual([]);
                return true;
            }));
    });

    describe('MANIPULATING PROJECTS EXISTENCE', () => {
        test('Create project (admin)', () => admin
            .post('/graphql')
            .send({ query: CREATE_PROJECT, variables: { study: 'Study001', project: 'Project001' } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.createProject.id).toBe(studyId);
                expect(res.body.data.createProject.projects).toBeDefined();
                expect(typeof res.body.data.createProject.projects[0].id).toBe('string');
                projectId = res.body.data.createProject.projects[0].id;
                expect(res.body.data.createProject.projects[0].name).toBe('Project001');
                return true;
            }));

        test('Create project (user)', () => user
            .post('/graphql')
            .send({ query: CREATE_PROJECT, variables: { study: 'Study001', project: 'Project002' } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.createProject).toBeNull();
                expect(res.body.errors[0].message).toBe('Unauthorised.');
                expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
                return true;
            }));

        test('edit project approved fields with incorrect field (as string) (user)', () => user
            .post('/graphql')
            .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 'non-existent-field' } } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.editProjectApprovedFields).toBeNull();
                expect(res.body.errors[0].message).toBe('Unauthorised.');
                expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
                return true;
            }));

        test('edit project approved fields with incorrect field (doesnt exist) (user)', () => user
            .post('/graphql')
            .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 9999999999 } } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.editProjectApprovedFields).toBeNull();
                expect(res.body.errors[0].message).toBe('Unauthorised.');
                expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
                return true;
            }));

        test('edit project approved fields with correct field number (user)', () => user
            .post('/graphql')
            .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 32 } } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.editProjectApprovedFields).toBeNull();
                expect(res.body.errors[0].message).toBe('Unauthorised.');
                expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
                return true;
            }));

        test('edit project approved fields with incorrect field (as string) (admin)', () => admin
            .post('/graphql')
            .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 'non-existent-field' } } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.editProjectApprovedFields).toBeNull();
                expect(res.body.errors[0].message).toBe('Unauthorised.');
                expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
                return true;
            }));

        test('edit project approved fields with incorrect field (doesnt exist) (admin)', () => admin
            .post('/graphql')
            .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 99999999999 } } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.editProjectApprovedFields).toBeNull();
                expect(res.body.errors[0].message).toBe('Unauthorised.');
                expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
                return true;
            }));

        test('edit project approved fields with correct field number (admin)', () => admin
            .post('/graphql')
            .send({ query: EDIT_PROJECT_APPROVED_FIELDS, variables: { changes: { add: 32 } } })
            .then((res) => {
                expect(res.status).toBe(200);
                expect(res.body.data.editProjectApprovedFields).toBeNull();
                expect(res.body.errors[0].message).toBe('Unauthorised.');
                expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
                return true;
            }));
    });
});

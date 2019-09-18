const request = require('supertest');
const admin = request.agent(global._APP_);
const user = request.agent(global._APP_);
const { connectAdmin, connectUser, disconnectAgent } = require('./loginHelper');
const { WHO_AM_I, ADD_SHORT_CUT, REMOVE_SHORT_CUT } = require('./gql/usersGql');
const { Models } = require('itmat-utils');
const { GET_SPECIFIC_USER, GET_USERS_LIST, CREATE_USER, EDIT_USER, DELETE_USER } = require('./gql/appUsersGql');

beforeAll(async () => { // eslint-disable-line no-undef
    await connectAdmin(admin);
    await connectUser(user);
});

let shortcutIdUser;
let shortcutIdAdmin;

describe('USERS API', () => {
    describe('END USERS API', () => {
        test('Who am I (admin)',  () => admin
            .post('/graphql')
            .send({ query: WHO_AM_I })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.whoAmI.username).toBe('admin');
                expect(res.body.data.whoAmI.type).toBe(Models.UserModels.userTypes.ADMIN);
                expect(res.body.data.whoAmI.realName).toBe('admin');
                expect(res.body.data.whoAmI.email).toBe('admin@user.io');
                expect(res.body.data.whoAmI.createdBy).toBe('chon');
                expect(res.body.data.whoAmI.emailNotificationsActivated).toBe(false);
                expect(res.body.data.whoAmI.id).toBeDefined();
                expect(res.body.data.whoAmI.shortcuts).toEqual([]);
                return true;
        }));

        test('Who am I (user)', () => user
            .post('/graphql')
            .send({ query: WHO_AM_I })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.whoAmI.username).toBe('standardUser');
                expect(res.body.data.whoAmI.type).toBe(Models.UserModels.userTypes.STANDARD);
                expect(res.body.data.whoAmI.realName).toBe('Chan Tai Man');
                expect(res.body.data.whoAmI.email).toBe('standard@user.io');
                expect(res.body.data.whoAmI.createdBy).toBe('admin');
                expect(res.body.data.whoAmI.emailNotificationsActivated).toBe(true);
                expect(res.body.data.whoAmI.id).toBeDefined();
                expect(res.body.data.whoAmI.shortcuts).toEqual([]);
                return true;
        }));

        test('Add shortcut (study + application) (admin)',  () => admin
            .post('/graphql')
            .send({ query: ADD_SHORT_CUT, variables: { study: 'study001', project: 'youtube' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.addShortCut.username).toBe('admin');
                expect(res.body.data.addShortCut.shortcuts.length).toBe(1);
                expect(res.body.data.addShortCut.shortcuts[0].study).toBe('study001');
                expect(res.body.data.addShortCut.shortcuts[0].project).toBe('youtube');
                shodrcutIdAdmin = res.body.data.addShortCut.shortcuts[0].id;
                return true;
        }));

        test('Add shortcut (study) (user)', () => user
            .post('/graphql')
            .send({ query: ADD_SHORT_CUT, variables: { study: 'study001' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.addShortCut.username).toBe('standardUser');
                expect(res.body.data.addShortCut.shortcuts.length).toBe(1);
                expect(res.body.data.addShortCut.shortcuts[0].study).toBe('study001');
                expect(res.body.data.addShortCut.shortcuts[0].project).toBe(undefined);
                shortcutIdUser = res.body.data.addShortCut.shortcuts[0].id;
                return true;
        }));

        test('Add shortcut (study) (admin)',  () => admin
            .post('/graphql')
            .send({ query: ADD_SHORT_CUT, variables: { study: 'study001' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.addShortCut.username).toBe('admin');
                expect(res.body.data.addShortCut.shortcuts.length).toBe(2);
                expect(res.body.data.addShortCut.shortcuts[0].study).toBe('study001');
                expect(res.body.data.addShortCut.shortcuts[0].project).toBe('youtube');
                expect(res.body.data.addShortCut.shortcuts[1].study).toBe('study001');
                expect(res.body.data.addShortCut.shortcuts[1].project).toBe(undefined);
                return true;
        }));

        test('Add shortcut (study + application) (user)', () => user
            .post('/graphql')
            .send({ query: ADD_SHORT_CUT, variables: { study: 'study001', project: 'youtube' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.addShortCut.username).toBe('standardUser');
                expect(res.body.data.addShortCut.shortcuts.length).toBe(2);
                expect(res.body.data.addShortCut.shortcuts[0].study).toBe('study001');
                expect(res.body.data.addShortCut.shortcuts[0].project).toBe(undefined);
                expect(res.body.data.addShortCut.shortcuts[1].study).toBe('study001');
                expect(res.body.data.addShortCut.shortcuts[1].project).toBe('youtube');
                return true;
        }));

        test('Add shortcut (study) that already exists (admin)',  () => admin
            .post('/graphql')
            .send({ query: ADD_SHORT_CUT, variables: { study: 'study001' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.addShortCut.username).toBe('admin');
                expect(res.body.data.addShortCut.shortcuts.length).toBe(3);
                return true;
        }));

        test('Add shortcut (study + application) that already exists  (user)', () => user
            .post('/graphql')
            .send({ query: ADD_SHORT_CUT, variables: { study: 'study001', project: 'youtube' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.addShortCut.username).toBe('standardUser');
                expect(res.body.data.addShortCut.shortcuts.length).toBe(3);
                throw Error('');
                return true;
        }));

        test('Remove shortcut that doesnt exist (user)', () => user
            .post('/graphql')
            .send({ query: REMOVE_SHORT_CUT, variables: { shortCutId: 'fakeshortcutid' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.removeShortCut.username).toBe('standardUser');
                expect(res.body.data.removeShortCut.shortcuts.length).toBe(3);
                return true;
        }));

        test('Remove shortcut that doesnt exist (admin)', () => admin
            .post('/graphql')
            .send({ query: REMOVE_SHORT_CUT, variables: { shortCutId: 'fakeshortcutid' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.removeShortCut.username).toBe('admin');
                expect(res.body.data.removeShortCut.shortcuts.length).toBe(3);
                return true;
        }));

        test('Remove shortcut (user)', () => user
            .post('/graphql')
            .send({ query: REMOVE_SHORT_CUT, variables: { shortCutId: shortcutIdUser } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.removeShortCut.username).toBe('standardUser');
                expect(res.body.data.removeShortCut.shortcuts.length).toBe(2);
                return true;
        }));

        test('Remove shortcut (admin)', () => admin
            .post('/graphql')
            .send({ query: REMOVE_SHORT_CUT, variables: { shortCutId: shortcutIdAdmin } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.removeShortCut.username).toBe('admin');
                expect(res.body.data.removeShortCut.shortcuts.length).toBe(2);
                return true;
        }));
    });

    describe('APP USERS API', () => {
        test('Get all users (admin)',  () => admin
            .post('/graphql')
            .send({ query: GET_USERS_LIST })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.getUsers.length).toBe(2);
                expect(res.body.data.getUsers[0].username).toBe('admin');
                expect(res.body.data.getUsers[0].id).toBeDefined();
                expect(res.body.data.getUsers[0].type).toBe(Models.UserModels.userTypes.ADMIN);
                expect(res.body.data.getUsers[0].realName).toBe('admin');
                expect(res.body.data.getUsers[0].email).toBe('admin@user.io');
                expect(res.body.data.getUsers[1].username).toBe('standardUser');
                expect(res.body.data.getUsers[1].id).toBeDefined();
                expect(res.body.data.getUsers[1].type).toBe(Models.UserModels.userTypes.STANDARD);
                expect(res.body.data.getUsers[1].realName).toBe('chanTaiMan');
                expect(res.body.data.getUsers[1].email).toBe('standard@user.io');
                return true;
        }));

        test('Get all users with details (user)',  () => user
            .post('/graphql')
            .send({ query: GET_USERS_LIST })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.error).toBeDefined();
                expect(res.body.data).toBe(null);
                return true;
        }));

        // test('Get all users only id and username (user)',  () => user
        //     .post('/graphql')
        //     .send({ query: GET_USERS_LIST_ONLY_USERNAME })
        //     .then(res => {
        //         expect(res.status).toBe(200);
        //         expect(res.body.data.getUsers.length).toBe(2);
        //         expect(res.body.data.getUsers[0].username).toBe('admin');
        //         expect(res.body.data.getUsers[0].id).toBeDefined();
        //         expect(res.body.data.getUsers[0].type).toBeUndefined();
        //         expect(res.body.data.getUsers[0].realName).toBeUndefined();
        //         expect(res.body.data.getUsers[0].email).toBeUndefined();
        //         expect(res.body.data.getUsers[1].username).toBe('standardUser');
        //         expect(res.body.data.getUsers[1].id).toBeDefined();
        //         expect(res.body.data.getUsers[1].type).toBeUndefined();
        //         expect(res.body.data.getUsers[1].realName).toBeUndefined();
        //         expect(res.body.data.getUsers[1].email).toBeUndefined();
        //         return true;
        // }));

        test('Get a specific user (admin)',  () => admin
            .post('/graphql')
            .send({ query: GET_SPECIFIC_USER, variables: { username: 'standardUser' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data.getUsers.length).toBe(1);
                expect(res.body.data.getUsers[0].username).toBe('standardUser');
                expect(res.body.data.getUsers[0].id).toBeDefined();
                expect(res.body.data.getUsers[0].type).toBe(Models.UserModels.userTypes.STANDARD);
                expect(res.body.data.getUsers[0].realName).toBe('chanTaiMan');
                expect(res.body.data.getUsers[0].email).toBe('standard@user.io');
                return true;
        }));

        test('Get a specific non-self user (user)',  () => user
            .post('/graphql')
            .send({ query: GET_SPECIFIC_USER, variables: { username: 'admin' }})
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data).toBeUndefined();
                expect(res.body.error).toBeDefined();
                return true;
        }));

        test('Get a specific self user (user)',  () => user
            .post('/graphql')
            .send({ query: GET_SPECIFIC_USER, variables: { username: 'standardUser' } })
            .then(res => {
                expect(res.status).toBe(200);
                expect(res.body.data).toBeUndefined();
                expect(res.body.error).toBeDefined();
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
});
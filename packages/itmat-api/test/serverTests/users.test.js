const request = require('supertest');
const gql = require('graphql-tag');
const { print } = require('graphql');
const admin = request.agent(global._APP_);
const user = request.agent(global._APP_);
const { connectAdmin, connectUser, disconnectAgent } = require('./loginHelper');

const WHO_AM_I = print(gql`
{
    whoAmI {
        id
        username
        type
        realName
        shortcuts {
            id
            application
            study
        }
        email
        emailNotificationsActivated
        createdBy
    }
}
`);

beforeAll(async () => { //eslint-disable-line no-undef
    await connectAdmin(admin);
    await connectUser(user);
});


// afterAll(() => {
//     mongod.stop();
// });

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

});
// originally from dsi-icl/optimise-core
'use strict';
const gql = require('graphql-tag');
const { print } = require('graphql');

const LOGIN = print(gql`
mutation login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
        id
        username
        type
        realName
        shortcuts {
            id
            project
            study
        }
        email
        emailNotificationsActivated
        createdBy
    }
}
`);

const LOGOUT = print(gql`
    mutation {
        logout{
            successful
            id
        }
    }
`);

function connectAdmin(agent) {
    return connectAgent(agent, 'admin', 'admin');
}

function connectUser(agent) {
    return connectAgent(agent, 'standardUser', 'admin');
}

function connectAgent(agent, user, pw) {
    return new Promise((resolve, reject) => agent.post('/graphql')
        .set('Content-type', 'application/json')
        .send({
            query: LOGIN,
            variables: { username: user, password: pw }
        })
        .then(res => {
            if (res.statusCode === 200)
                return resolve();
            return reject();
        }).catch(() => null));
}

function disconnectAgent(agent) {
    return new Promise((resolve, reject) => agent.post('/graphql')
        .send({
            query: LOGOUT,
        })
        .then(res => {
            if (res.statusCode === 200)
                return resolve();
            return reject();
        }).catch(() => null));
}

module.exports = { connectAdmin: connectAdmin, connectUser: connectUser, disconnectAgent: disconnectAgent };
// originally from dsi-icl/optimise-core
'use strict';
const gql = require('graphql-tag');
const { print } = require('graphql');
const itmatCommons = require('itmat-commons');
const { LOGIN, LOGOUT } = itmatCommons.GQLRequests;

export function connectAdmin(agent) {
    return connectAgent(agent, 'admin', 'admin');
}

export function connectUser(agent) {
    return connectAgent(agent, 'standardUser', 'admin');
}

export function connectAgent(agent, user, pw) {
    return new Promise((resolve, reject) => agent.post('/graphql')
        .set('Content-type', 'application/json')
        .send({
            query: print(LOGIN),
            variables: { username: user, password: pw }
        })
        .then(res => {
            if (res.statusCode === 200)
                return resolve();
            return reject();
        }).catch(() => null));
}

export function disconnectAgent(agent) {
    return new Promise((resolve, reject) => agent.post('/graphql')
        .send({
            query: print(LOGOUT),
        })
        .then(res => {
            if (res.statusCode === 200)
                return resolve();
            return reject();
        }).catch(() => null));
}

export default { connectAgent, connectAdmin, connectUser, disconnectAgent };
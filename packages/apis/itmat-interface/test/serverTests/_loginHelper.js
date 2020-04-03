// originally from dsi-icl/optimise-core

const { print } = require('graphql');
const itmatCommons = require('@itmat/commons');

const { LOGIN, LOGOUT } = itmatCommons;

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
            query: print(LOGIN),
            variables: { username: user, password: pw },
        })
        .then((res) => {
            if (res.statusCode === 200) return resolve();
            return reject();
        })
        .catch(() => null));
}

function disconnectAgent(agent) {
    return new Promise((resolve, reject) => agent.post('/graphql')
        .send({
            query: print(LOGOUT),
        })
        .then((res) => {
            if (res.statusCode === 200) return resolve();
            return reject();
        }).catch(() => null));
}

module.exports = {
    connectAgent, connectAdmin, connectUser, disconnectAgent,
};

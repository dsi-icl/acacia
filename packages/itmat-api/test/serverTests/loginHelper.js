// originally from dsi-icl/optimise-core
'use strict';

function connectAdmin(agent) {
    return connectAgent(agent, 'admin', 'admin');
}

function connectUser(agent) {
    return connectAgent(agent, 'user', 'user');
}

function connectAgent(agent, user, pw) {
    return new Promise((resolve, reject) => agent.post('/login')
        .set('Content-type', 'application/json')
        .send({
            username: user,
            password: pw
        })
        .then(res => {
            if (res.statusCode === 200)
                return resolve();
            return reject();
        }).catch(() => null));
}

function disconnectAgent(agent) {
    return new Promise((resolve, reject) => agent.post('/logout')
        .then(res => {
            if (res.statusCode === 200)
                return resolve();
            return reject();
        }).catch(() => null));
}

module.exports = { connectAdmin: connectAdmin, connectUser: connectUser, disconnectAgent: disconnectAgent };
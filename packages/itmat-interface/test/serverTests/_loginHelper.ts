// originally from dsi-icl/optimise-core

import { print } from 'graphql';
import { LOGIN, LOGOUT } from '@itmat/commons';

export const connectAgent = (agent, user, pw): Promise<void> => {
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
};

export const disconnectAgent = (agent): Promise<void> => {
    return new Promise((resolve, reject) => agent.post('/graphql')
        .send({
            query: print(LOGOUT),
        })
        .then((res) => {
            if (res.statusCode === 200) return resolve();
            return reject();
        }).catch(() => null));
};

export const connectAdmin = (agent): Promise<void> => {
    return connectAgent(agent, 'admin', 'admin');
};

export const connectUser = (agent): Promise<void> => {
    return connectAgent(agent, 'standardUser', 'admin');
};
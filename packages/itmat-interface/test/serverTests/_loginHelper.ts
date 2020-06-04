// originally from dsi-icl/optimise-core
'use strict';
import gql from 'graphql-tag';
import { print } from 'graphql';
import * as itmatCommons from 'itmat-commons';
import * as mfa from '../../src/utils/mfa';

const { LOGIN, LOGOUT } = itmatCommons.GQLRequests;

export function connectAdmin(agent) {
    const adminSecret = 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA';
    return connectAgent(agent, 'admin', 'admin', adminSecret);
}

export function connectUser(agent) {
    const userSecret = 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA';
    return connectAgent(agent, 'standardUser', 'admin', userSecret);
}

export function connectAgent(agent, user, pw, secret) {
    const otp = mfa.generateTOTP(secret).toString();
    return new Promise((resolve, reject) => agent.post('/graphql')
        .set('Content-type', 'application/json')
        .send({
            query: print(LOGIN),
            variables: { username: user, password: pw, totp: otp}
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

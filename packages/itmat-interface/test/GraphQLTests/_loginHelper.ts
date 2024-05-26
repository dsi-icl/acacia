import { print } from 'graphql';
import { LOGIN, LOGOUT } from '@itmat-broker/itmat-models';
import { SuperTest, Test } from 'supertest';
import { generateTOTP } from '@itmat-broker/itmat-cores';

export async function connectAdmin(agent: SuperTest<Test>): Promise<void> {
    const adminSecret = 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA';
    return connectAgent(agent, 'admin', 'admin', adminSecret);
}

export async function connectUser(agent: SuperTest<Test>): Promise<void> {
    const userSecret = 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA';
    return connectAgent(agent, 'standardUser', 'admin', userSecret);
}

export async function connectAgent(agent: SuperTest<Test>, user: string, pw: string, secret: string): Promise<void> {
    const otp = generateTOTP(secret).toString();
    return agent.post('/graphql')
        .set('Content-type', 'application/json')
        .send({
            query: print(LOGIN),
            variables: { username: user, password: pw, totp: otp }
        })
        .then(res => {
            if (res.status !== 200)
                throw new Error('Connect failed');
        }).catch(() => { return; });
}

export async function disconnectAgent(agent: SuperTest<Test>): Promise<void> {
    return agent.post('/graphql')
        .send({
            query: print(LOGOUT)
        })
        .then(res => {
            if (res.status !== 200)
                throw new Error('Disconnect failed');
        }).catch(() => { return; });
}

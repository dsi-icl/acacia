import { generateTOTP } from '@itmat-broker/itmat-cores';
import { SuperTest, Test } from 'supertest';

export async function connectAdmin(agent: SuperTest<Test>) {
    const adminSecret = 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA';
    return connectAgent(agent, 'admin', 'admin', adminSecret);
}

export async function connectUser(agent: SuperTest<Test>) {
    const userSecret = 'H6BNKKO27DPLCATGEJAZNWQV4LWOTMRA';
    return connectAgent(agent, 'standardUser', 'admin', userSecret);
}

export async function connectAgent(agent: SuperTest<Test>, user: string, pw: string, secret: string): Promise<void> {
    const otp = generateTOTP(secret).toString();
    try {
        const res = await agent.post('/trpc/user.login')
            .set('Content-type', 'application/json')
            .send({
                username: user,
                password: pw,
                totp: otp
            });
        if (res.status !== 200) {
            throw new Error('Login failed');
        }
    } catch (__unused__exception) {
        throw new Error('Login request failed');
    }
}

export async function disconnectAgent(agent: SuperTest<Test>): Promise<void> {
    try {
        const res = await agent.post('/trpc/user.logout');
        if (res.status !== 200) {
            throw new Error('Logout failed');
        }
    } catch (__unused__exception) {
        throw new Error('Logout request failed');
    }
}


/**
 * @with Minio
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { MongoMemoryServer } from 'mongodb-memory-server';
import { db } from '../../src/database/database';
import { Express } from 'express';
import { objStore } from '../../src/objStore/objStore';
import request from 'supertest';
import { connectAdmin, connectUser } from './_loginHelper';
import { Router } from '../../src/server/router';
import { Db, MongoClient } from 'mongodb';
import { setupDatabase } from '@itmat-broker/itmat-setup';
import config from '../../config/config.sample.json';
import { v4 as uuid } from 'uuid';
import { IUser, enumUserTypes } from '@itmat-broker/itmat-types';
import { encodeQueryParams } from './helper';
import { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON, PublicKeyCredentialRequestOptionsJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';

import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import {
    RegistrationResponseJSON,
    PublicKeyCredentialCreationOptionsJSON
} from '@simplewebauthn/types';

import { WebauthnCore} from '@itmat-broker/itmat-cores';

jest.mock('nodemailer', () => {
    const { TEST_SMTP_CRED, TEST_SMTP_USERNAME } = process.env;
    if (!TEST_SMTP_CRED || !TEST_SMTP_USERNAME || !config?.nodemailer?.auth?.pass || !config?.nodemailer?.auth?.user)
        return {
            createTransport: jest.fn().mockImplementation(() => ({
                sendMail: jest.fn()
            }))
        };
    return jest.requireActual('nodemailer');
});

// Mock the @simplewebauthn/browser module
jest.mock('@simplewebauthn/browser', () => ({
    startRegistration: jest.fn().mockResolvedValue({
        id: 'mock_id',
        rawId: 'mock_rawId',
        response: {
            clientDataJSON: 'mock_clientDataJSON',
            attestationObject: 'mock_attestationObject',
            transports: ['internal'] // Ensure transports is included if expected
        },
        type: 'public-key',
        clientExtensionResults: {}
    }),
    startAuthentication: jest.fn().mockResolvedValue({
        id: 'mock_id', // Use the same id
        rawId: 'mock_rawId', // Use the same rawId as in startRegistration
        response: {
            clientDataJSON: 'mock_clientDataJSON',
            authenticatorData: 'mock_authenticatorData',
            signature: 'mock_signature'
        },
        type: 'public-key',
        clientExtensionResults: {}
    })
}));

jest.mock('@simplewebauthn/server', () => ({
    verifyRegistrationResponse: jest.fn().mockResolvedValue({
        verified: true,
        registrationInfo: {
            credentialPublicKey: new Uint8Array([1, 2, 3]), // Mocked public key
            credentialID: 'mock_rawId', // Should match the rawId in startRegistration mock
            counter: 0
        }
    }),
    verifyAuthenticationResponse: jest.fn().mockResolvedValue({
        verified: true,
        authenticationInfo: {
            newCounter: 1
        }
    }),
    generateRegistrationOptions: jest.fn().mockReturnValue({
        rp: {
            name: 'mock_rpName',
            id: 'mock_rpID'
        },
        user: {
            id: new Uint8Array([1, 2, 3, 4]),
            name: 'mock_username',
            displayName: 'mock_displayName'
        },
        challenge: new Uint8Array([1, 2, 3, 4, 5]),
        pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 }
        ],
        timeout: 60000,
        attestation: 'none',
        excludeCredentials: [
            {
                id: new Uint8Array([1, 2, 3]),
                type: 'public-key',
                transports: ['internal']
            }
        ],
        authenticatorSelection: {
            residentKey: 'discouraged'
        }
    }),
    generateAuthenticationOptions: jest.fn().mockReturnValue({
        challenge: 'mock_challenge',
        rpId: 'mock_rpId',
        allowCredentials: [
            {
                id: 'mock_credential_id',
                type: 'public-key',
                transports: ['internal']
            }
        ]
    })
}));


if (global.hasMinio) { // eslint-disable-line no-undef
    let app: Express;
    let mongodb: MongoMemoryServer;
    let admin: request.SuperTest<request.Test>;
    let user: request.SuperTest<request.Test>;
    let mongoConnection: MongoClient;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mongoClient: Db;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let adminProfile: IUser;
    let userProfile: IUser;
    const setupDatabaseAndApp = async () => {

        const dbName = uuid();
        mongodb = await MongoMemoryServer.create({ instance: { dbName } });
        const connectionString = mongodb.getUri();
        await setupDatabase(connectionString, dbName);

        config.objectStore.port = global.minioContainerPort;
        config.database.mongo_url = connectionString;
        config.database.database = dbName;

        await db.connect(config.database, MongoClient);

        await objStore.connect(config.objectStore);

        const router = new Router(config);
        await router.init();

        mongoConnection = await MongoClient.connect(connectionString);
        mongoClient = mongoConnection.db(dbName);

        app = router.getApp();
        admin = request.agent(app);
        user = request.agent(app);
        await connectAdmin(admin);
        await connectUser(user);

        const users = await db.collections.users_collection.find({}).toArray();
        adminProfile = users.find(el => el.type === enumUserTypes.ADMIN);
        userProfile = users.find(el => el.type === enumUserTypes.STANDARD);

    };

    // Mocking getCurrentOriginAndRpID method only
    let webauthnCoreMock: jest.SpyInstance;

    beforeAll(async () => {
        await setupDatabaseAndApp();

        // Mock getCurrentOriginAndRpID method
        webauthnCoreMock = jest.spyOn(WebauthnCore.prototype, 'getCurrentOriginAndRpID')
            .mockResolvedValue({
                origin: 'http://localhost:3000',
                rpID: 'localhost'
            });
    });

    afterAll(async () => {
        await db.closeConnection();
        await mongoConnection.close();
        await mongodb.stop();
        webauthnCoreMock.mockRestore(); // Restore original method after tests
        jest.clearAllMocks();
    });

    describe('tRPC WebAuthn APIs', () => {

        test('Should verify WebAuthn registration and retrieve WebAuthn ID successfully', async () => {
            // Step 1: Get registration options
            const registrationResponse = await user.post('/trpc/webauthn.webauthnRegister').send();

            expect(registrationResponse.status).toBe(200);

            // Extract the webauthn_id from the registration response
            const webauthnId = registrationResponse.body.result.data.webauthn_id;

            // Step 2: Generate the attestation response using startRegistration
            const registrationOptions: PublicKeyCredentialCreationOptionsJSON = registrationResponse.body.result.data.options;
            const attestationResponse: RegistrationResponseJSON = await startRegistration(registrationOptions);

            // Step 3: Verify the registration response
            const verifyResponse = await user.post('/trpc/webauthn.webauthnRegisterVerify')
                .send({ attestationResponse })
                .set('Content-Type', 'application/json');

            // Step 4: Check the verification result
            expect(verifyResponse.status).toBe(200);
            expect(verifyResponse.body.result.data.successful).toBe(true);

            // Step 5: Use the webauthn_id to retrieve the registered WebAuthn data via the query endpoint
            const paramteres = {
                webauthn_ids: [webauthnId]
            };
            const getWebauthnResponse = await user.get('/trpc/webauthn.getWebauthn?input=' + encodeQueryParams(paramteres))
                .query({});

            // Step 6: Validate the response
            expect(getWebauthnResponse.status).toBe(200);
            expect(getWebauthnResponse.body.result.data).toBeDefined();
            expect(getWebauthnResponse.body.result.data).toHaveLength(1);

            // Step 7: Query the WebAuthn ID using the getWebauthnID endpoint
            const getWebauthnIDResponse = await user.get('/trpc/webauthn.getWebauthnID')
                .set('Content-Type', 'application/json');

            // Validate the response
            expect(getWebauthnIDResponse.status).toBe(200);
            expect(getWebauthnIDResponse.body.result.data).toBeDefined();

            // Verify that the returned WebAuthn ID matches the expected ID from the registration process
            const webauthnData = getWebauthnIDResponse.body.result.data;
            expect(webauthnData).toHaveProperty('id', webauthnId); // Ensure the ID matches the one returned during registration

            // Optional: Verify the device information
            const webauthnRecord = await db.collections.webauthn_collection.findOne({ userId: userProfile.id });
            expect(webauthnRecord).toBeDefined();
            expect(webauthnRecord?.devices).toHaveLength(1);
            expect(webauthnRecord?.devices[0].credentialID).toBe(attestationResponse.rawId);
        });



        test('Should verify WebAuthn authentication successfully', async () => {
            // Step 1: Get authentication options
            const authOptionsResponse = await user.post('/trpc/webauthn.webauthnAuthenticate')
                .send({ userId: userProfile.id })
                .set('Content-Type', 'application/json');

            expect(authOptionsResponse.status).toBe(200);

            // Step 2: Generate the assertion response using startAuthentication
            const authenticationOptions: PublicKeyCredentialRequestOptionsJSON = authOptionsResponse.body.result.data;
            const assertionResponse: AuthenticationResponseJSON = await startAuthentication(authenticationOptions);

            // Step 3: Verify the authentication response
            const verifyResponse = await user.post('/trpc/webauthn.webauthnAuthenticateVerify')
                .send({
                    userId: userProfile.id,
                    assertionResponse: assertionResponse
                })
                .set('Content-Type', 'application/json');

            // Step 4: Check the verification result
            expect(verifyResponse.status).toBe(200);
            expect(verifyResponse.body.result.data.successful).toBe(true);

            // Step 5: Check that the webauthn record was updated correctly
            const webauthnRecord = await db.collections.webauthn_collection.findOne({ userId: userProfile.id });
            expect(webauthnRecord).toBeDefined();
            expect(webauthnRecord?.devices).toHaveLength(1);
            expect(webauthnRecord?.devices[0].counter).toBeGreaterThan(0);
        });
        test('Should retrieve, update, and delete WebAuthn registered device successfully', async () => {
            // Step 1: Retrieve the registered devices using the API
            const getDevicesResponse = await user.get('/trpc/webauthn.getWebauthnRegisteredDevices').send();

            // Validate the response and ensure there are registered devices
            expect(getDevicesResponse.status).toBe(200);
            expect(getDevicesResponse.body.result.data).toBeDefined();
            expect(getDevicesResponse.body.result.data).toHaveLength(1); // there's one device registered from the previous tests

            const registeredDevices = getDevicesResponse.body.result.data;
            const mockDeviceId = registeredDevices[0].id; // Select the first device ID to update and delete
            const newDeviceName = 'Updated Device Name';

            // Step 2: Perform the update operation via the API to change the device's name
            const updateNameResponse = await user.post('/trpc/webauthn.updateWebauthnDeviceName')
                .send({
                    deviceId: mockDeviceId,
                    name: newDeviceName
                })
                .set('Content-Type', 'application/json');

            // Validate the response after updating the device name
            expect(updateNameResponse.status).toBe(200);
            expect(updateNameResponse.body.result.data).toBeDefined();

            // Step 3: Verify that the device name has been updated from the response
            const updatedDevices = updateNameResponse.body.result.data;
            const updatedDevice = updatedDevices.find(device => device.id === mockDeviceId);
            expect(updatedDevice).toBeDefined();
            expect(updatedDevice?.name).toBe(newDeviceName); // Ensure the device name is updated

            // Step 4: Perform the delete operation via the API
            const deleteDeviceResponse = await user.post('/trpc/webauthn.deleteWebauthnRegisteredDevices')
                .send({ deviceId: mockDeviceId })
                .set('Content-Type', 'application/json');

            // Validate the response and ensure the device list is now empty
            expect(deleteDeviceResponse.status).toBe(200);
            expect(deleteDeviceResponse.body.result.data).toBeDefined();
            expect(deleteDeviceResponse.body.result.data).toHaveLength(0); // The device list should now be empty
        });

        test('Should login with WebAuthn successfully', async () => {
            // Perform the login operation via the API
            const response = await user.post('/trpc/webauthn.webauthnLogin')
                .send({
                    userId: userProfile.id, // Adjusted to match the backend expectation (removed the 'input' wrapper)
                    requestExpiryDate: false
                })
                .set('Content-Type', 'application/json');

            // Validate the response
            expect(response.status).toBe(200);
            expect(response.body.result.data).toBeDefined();

            // check specific properties in the response
            expect(response.body.result.data).toHaveProperty('id', userProfile.id);
            expect(response.body.result.data).toHaveProperty('username', userProfile.username);
            expect(response.body.result.data).not.toHaveProperty('password'); // Ensure password is not included in the response
        });
    });
} else {
    test(`${__filename.split(/[\\/]/).pop()} skipped because it requires Minio on Docker`, () => {
        expect(true).toBe(true);
    });
}

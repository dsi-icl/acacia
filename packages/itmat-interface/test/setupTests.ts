
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck



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



import { LxdManager, UserCore } from '@itmat-broker/itmat-cores';

// Stub out the LXD client initialization to bypass certificate parsing for tests
jest.spyOn(LxdManager.prototype as LxdManager, 'initializeLXDClient').mockResolvedValue(undefined);
jest.spyOn(UserCore.prototype as UserCore,'initialize').mockResolvedValue(undefined);

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
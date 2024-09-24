import { CoreError,IUser,enumCoreErrors, AuthenticatorDevice, IUserWithoutToken, enumUserTypes} from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { Logger, Mailer, ObjectStore } from '@itmat-broker/itmat-commons';
import { IConfiguration, makeGenericResponse} from '../utils';
import { ConfigCore } from './configCore';
import {formatEmailRequestExpiryDatetoAdmin, formatEmailRequestExpiryDatetoClient} from './userCore';
import { v4 as uuid } from 'uuid';
import * as mfa from '../utils/mfa';


import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse

} from '@simplewebauthn/server';

import type {
    RegistrationResponseJSON,
    PublicKeyCredentialRequestOptionsJSON,
    AuthenticationResponseJSON
} from '@simplewebauthn/types';


import { isoBase64URL} from '@simplewebauthn/server/helpers';


export class WebauthnCore {
    db: DBType;
    mailer: Mailer;
    config: IConfiguration;
    objStore: ObjectStore;
    configCore: ConfigCore;
    rpName: string;
    constructor(db: DBType, mailer: Mailer, config: IConfiguration, objStore: ObjectStore) {
        this.db = db;
        this.mailer = mailer;
        this.config = config;
        this.objStore = objStore;
        this.configCore = new ConfigCore(db);
        // get the rpName,from the config
        this.rpName = config.appName;
    }
    /**
     * webauthn functions
     *
     * generate a random challenge for webauthn registration and authentication
     * @returns - the challenge: Uint8Array
     */
    private generate_challenge() {

        const randomStringFromServer = mfa.generateSecret(20);
        const challenge: Uint8Array = new TextEncoder().encode(randomStringFromServer);
        return challenge;
    }
    /**
     * get the webauthn data for a list of webauthn_ids
     * @param webauthn_ids
     * @returns
     */
    public async getWebauthn(webauthn_ids: string[]) {
        if (webauthn_ids.length === 0) return [];
        const queryObj = {id: { $in: webauthn_ids } };
        const cursor = this.db.collections.webauthn_collection.find(queryObj, { projection: { _id: 0 } });
        return cursor.toArray();
    }
    /**
     *  get the registered webauthn device for a user.
     * @param user - The user.
     * @returns - The registration options.
     */
    public async getWebauthnDevices(user: IUser): Promise<AuthenticatorDevice[] | []> {

        const webauthnCursor = await this.db.collections.webauthn_collection.findOne({userId: user.id}, { projection: { _id: 0 } });

        return webauthnCursor?.devices ?? [];
    }
    /**
     *  get the webauthn id for a user.
     * @param user  - The user.
     * @returns     - The webauthn object.
     */
    public async getUserWebAuthnID(user: IUser) {

        const webauthnCursor = await this.db.collections.webauthn_collection.findOne({ userId: user.id });

        if (!webauthnCursor) {
            return null; // No record found for the user, returning an empty
        }
        return webauthnCursor;
    }

    /**
     * delete a webauthn device for a user.
     * @param user - The user.
     * @param device_id - The device id.
     * @returns - The updated list of devices.
     */
    public async deleteWebauthnDevices(user: IUser, device_id: string) {
        const webAuthnData = await this.db.collections.webauthn_collection.findOne({ userId: user.id });
        if (webAuthnData){
            const deviceIndex = webAuthnData.devices.findIndex(device => device.id === device_id);
            if (deviceIndex === -1) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                    'Device does not exist.'
                );
            }
            webAuthnData.devices.splice(deviceIndex, 1);
            await this.db.collections.webauthn_collection.updateOne({ userId: user.id }, { $set: { devices: webAuthnData.devices } });
        }

        return webAuthnData?.devices ?? [];
    }
    /**
     * get the webauthn registration options for a user.
     * @param user
     * @returns   - The registration options.
     */
    public async getWebauthnRegistrationOptions(user: IUser, rpID: string) {
        let webauthn_id;
        const challenge = this.generate_challenge();
        const webauthnStore = await this.db.collections.webauthn_collection.findOne({
            userId: user.id
        });

        if (webauthnStore) {
            // update and get the webauthn_id
            webauthn_id = webauthnStore.id;
            await this.db.collections.webauthn_collection.updateOne({
                userId: user.id
            }, {
                $set: {
                    challenge,
                    challengeTimestamp: Date.now()
                }
            });
        } else {
            webauthn_id = uuid();
            await this.db.collections.webauthn_collection.insertOne({
                id: webauthn_id,
                userId: user.id,
                username: user.username,
                devices: [],
                challenge,
                challengeTimestamp: Date.now(),
                life: {
                    createdTime: Date.now(),
                    createdUser: user.id,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            });
        }

        const devices = webauthnStore?.devices ?? [];
        try {
            const options = await generateRegistrationOptions({
                rpName: this.rpName,
                rpID: rpID,
                userID: Buffer.from(user.id) as Uint8Array,
                userName: user.username,
                timeout: 60000,
                attestationType: 'none',
                excludeCredentials: devices.map((authenticator: AuthenticatorDevice) => ({
                    id: authenticator.credentialID,
                    type: 'public-key',
                    transports: authenticator.transports
                })),
                challenge: challenge.buffer as Uint8Array,
                authenticatorSelection: {
                    residentKey: 'discouraged'
                },
                supportedAlgorithmIDs: [-7, -257]

            });
            return {
                webauthn_id: webauthn_id,
                options: options
            };
        }
        catch (error) {
            Logger.error(`Error generating registration options: ${JSON.stringify(error)}`);
            throw new CoreError(
                enumCoreErrors.AUTHENTICATION_ERROR,
                'Failed to generate registration options'
            );}
    }
    /**
     *  handle the registration verify for a user.
     * @param user  - The user.
     * @param attestationResponse   - The attestation response.
     * @returns   - The response.
     */
    public async handleRegistrationVerify(user: IUser, attestationResponse: RegistrationResponseJSON, origin: string, rpID: string) {
        let device_id;
        const webauthn = await this.db.collections.webauthn_collection.findOne({
            userId: user.id
        });

        if (!webauthn) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Webauthn does not exist.'
            );
        }

        const { devices, challenge} = webauthn;

        const decodedString = isoBase64URL.fromBuffer(challenge.buffer as Uint8Array);

        try{
            // verify the registration response
            const {verified, registrationInfo} = await verifyRegistrationResponse({
                response: attestationResponse,
                expectedChallenge: decodedString,
                expectedOrigin: origin,
                expectedRPID: rpID,
                requireUserVerification: true
            });

            if (verified && registrationInfo) {
                const { credentialPublicKey, credentialID, counter } = registrationInfo;
                device_id = uuid();

                const newDevice: AuthenticatorDevice = {
                    credentialPublicKey,
                    credentialID,
                    counter,
                    transports: attestationResponse.response.transports,
                    id: device_id,
                    origin: origin
                };
                devices.push(newDevice);

                const updateResult = await this.db.collections.webauthn_collection.updateOne(
                    { id: webauthn.id },
                    {
                        $set: {
                            devices: devices
                        }
                    }
                );
                if (!updateResult.acknowledged) {
                    throw new CoreError(
                        enumCoreErrors.OBJ_STORE_ERROR,
                        'Failed to update devices list.'
                    );
                }
                return makeGenericResponse(device_id, true);
            }
            return makeGenericResponse(undefined, false);
        } catch (_error) {
            Logger.error(`Error for registeration verify ${JSON.stringify(_error)}`);
            return makeGenericResponse(undefined, false);
        }
    }
    /**
     *  get the webauthn authentication options for a user.
     * @param userId    - The user id.
     * @returns     - The authentication options.
     */
    public async getWebauthnAuthenticationOptions(userId: string, rpID: string): Promise<PublicKeyCredentialRequestOptionsJSON>{

        const webauthn = await this.db.collections.webauthn_collection.findOne({
            userId: userId
        });

        if (!webauthn) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Webauthn not initialised.'
            );
        }
        const {devices, challenge} = webauthn;

        try{
            const options = await generateAuthenticationOptions({
                challenge: challenge.buffer as Uint8Array,
                timeout: 60000,
                allowCredentials: devices.map((authenticator) => ({
                    id: authenticator.credentialID,
                    type: 'public-key',
                    transports: authenticator.transports
                })),
                userVerification: 'required',
                rpID: rpID
            });
            return options;
        }
        catch (_error) {
            Logger.error(`Error generating authentication options: ${JSON.stringify(_error)}`);
            throw new CoreError(
                enumCoreErrors.AUTHENTICATION_ERROR,
                'Failed to generate authentication options'
            );
        }
    }
    /**
     *  handle the authentication verify for a user.
     * @param userId       - The user id.
     * @param assertionResponse     - The assertion response.
     * @returns    - The response.
     */
    public async handleAuthenticationVerify(userId: string, assertionResponse: AuthenticationResponseJSON, origin: string, rpID: string) {


        const webauthn = await this.db.collections.webauthn_collection.findOne({
            userId: userId
        });
        if (!webauthn) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Webauthn not initialised.'
            );
        }

        const { devices, challenge} = webauthn;

        const decodedChallengeString = isoBase64URL.fromBuffer(challenge.buffer as Uint8Array);
        const bodyCredIDString = assertionResponse.rawId;
        const deviceIndex = devices.findIndex(d =>d.credentialID  === bodyCredIDString);

        if (deviceIndex < 0) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Authenticator is not registered with this site.'
            );
        }
        const device = devices[deviceIndex];
        if (!device.credentialPublicKey) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Credential public key is missing.'
            );
        }

        try {
            const verification = await verifyAuthenticationResponse({
                response: assertionResponse,
                expectedChallenge: decodedChallengeString,
                expectedOrigin: origin,
                expectedRPID: rpID,
                authenticator: {
                    credentialPublicKey: device.credentialPublicKey.buffer as Uint8Array,
                    credentialID: device.credentialID,
                    counter: device.counter
                },
                requireUserVerification: true
            });

            const { verified, authenticationInfo } = verification;

            if (verified) {

                const { newCounter } = authenticationInfo;
                devices[deviceIndex].counter = newCounter;

                const updateResult = await this.db.collections.webauthn_collection.updateOne(
                    { id: webauthn.id },
                    { $set: { devices } }
                );

                if (!updateResult.acknowledged) {
                    throw new CoreError(
                        enumCoreErrors.OBJ_STORE_ERROR,
                        'Failed to update authenticators.'
                    );
                }
                return makeGenericResponse(undefined, true);
            }
            return makeGenericResponse(undefined, false);
        } catch (_error) {
            Logger.error(JSON.stringify(_error));
            return makeGenericResponse(undefined, false) ;
        }

    }
    /**
     *  login a user using webauthn.
     * @param req   - The request.
     * @param userId    - The user id.
     * @param requestExpiryDate     - The request expiry date.
     * @returns     - The user without token.
     */
    public async webauthnLogin(req: Express.Request, userId: string, requestExpiryDate?: boolean): Promise<IUserWithoutToken> {
        const user = await this.db.collections.users_collection.findOne({ id: userId, deleted: null });
        if (!user) {
            throw new CoreError(enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, 'User does not exist.');
        }

        if (user.expiredAt && user.expiredAt < Date.now() && user.type === enumUserTypes.STANDARD) {
            if (requestExpiryDate) {
                await this.mailer.sendMail(formatEmailRequestExpiryDatetoAdmin({
                    config: this.config,
                    userEmail: user.email,
                    username: user.username
                }));
                await this.mailer.sendMail(formatEmailRequestExpiryDatetoClient({
                    config: this.config,
                    to: user.email,
                    username: user.username
                }));
                throw new CoreError(enumCoreErrors.UNQUALIFIED_ERROR, 'New expiry date has been requested! Wait for ADMIN to approve.');
            }
            throw new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'Account Expired. Please request a new expiry date!');
        }

        const { password: __unusedPassword, otpSecret: __unusedOtpSecret, ...filteredUser } = user;
        return new Promise((resolve, reject) => {
            req.login(filteredUser, (err) => {
                if (err) {
                    Logger.error(err);
                    reject(new CoreError(enumCoreErrors.AUTHENTICATION_ERROR, 'Cannot log in. Please try again later.'));
                } else {
                    resolve(filteredUser as IUserWithoutToken);
                }
            });
        });
    }
    /**
     *  register a user using webauthn.
     * @param user  - The user.
     * @param deviceId  - The device id.
     * @param deviceName   - The device name.
     * @returns     - The user without token.
     */
    public async updateWebauthnDeviceName(user: IUser, deviceId: string, deviceName: string) {
        const result = await this.db.collections.webauthn_collection.findOneAndUpdate(
            {
                'userId': user.id,
                'devices.id': deviceId
            },
            {
                $set: { 'devices.$.name': deviceName }
            },
            {
                returnDocument: 'after'
            }
        );

        if (!result) {
            throw new CoreError(
                enumCoreErrors.OBJ_STORE_ERROR,
                'Device not found or user mismatch.'
            );
        }

        return result.devices;
    }
    /**
     *  get the current origin and rpID.
     * @param ctx   - The context.
     * @returns     - The origin and rpID.
     */

    public async getCurrentOriginAndRpID(ctx) {
        const req = ctx.req;
        const origin = req.headers.origin;
        const rpID = (new URL(origin)).hostname;
        return {origin, rpID};
    }

}

import { ApolloServerErrorCode } from '@apollo/server/errors';
import { GraphQLError } from 'graphql';
import { mailer } from '../../emailer/emailer';
import { IUser, IPubkey, AccessToken, KeyPairwSignature, Signature } from '@itmat-broker/itmat-types';
//import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import config from '../../utils/configManager';
import { userCore } from '../core/userCore';
import { errorCodes } from '../errors';
//import { makeGenericReponse, IGenericResponse } from '../responses';
import * as pubkeycrypto from '../../utils/pubkeycrypto';
export const pubkeyResolvers = {
    Query: {
        getPubkeys: async (__unused__parent: Record<string, unknown>, args: any): Promise<IPubkey[]> => {
            // a user is allowed to obtain his/her registered public key.
            let queryObj;
            if (args.pubkeyId === undefined) {
                if (args.associatedUserId === undefined) {
                    queryObj = { deleted: null };
                } else {
                    queryObj = { deleted: null, associatedUserId: args.associatedUserId };
                }
            } else {
                queryObj = { deleted: null, id: args.pubkeyId };
            }
            const cursor = db.collections!.pubkeys_collection.find<IPubkey>(queryObj, { projection: { _id: 0 } });
            return cursor.toArray();
        }
    },

    Mutation: {
        keyPairGenwSignature: async (): Promise<KeyPairwSignature> => {
            // Generate RSA key-pair with Signature for robot user
            const keyPair = pubkeycrypto.rsakeygen();
            //default message = hash of the public key (SHA256)
            const messageToBeSigned = pubkeycrypto.hashdigest(keyPair.publicKey);
            const signature = pubkeycrypto.rsasigner(keyPair.privateKey, messageToBeSigned);

            return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, signature: signature };
        },

        rsaSigner: async (__unused__parent: Record<string, unknown>, { privateKey, message }: { privateKey: string, message: string }): Promise<Signature> => {
            let messageToBeSigned;
            privateKey = privateKey.replace(/\\n/g, '\n');
            if (message === undefined) {
                //default message = hash of the public key (SHA256)
                try {
                    const reGenPubkey = pubkeycrypto.reGenPkfromSk(privateKey);
                    messageToBeSigned = pubkeycrypto.hashdigest(reGenPubkey);
                } catch (error) {
                    throw new GraphQLError('Error: private-key incorrect!', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT, error } });
                }

            } else {
                messageToBeSigned = message;
            }
            const signature = pubkeycrypto.rsasigner(privateKey, messageToBeSigned);
            return { signature: signature };
        },

        issueAccessToken: async (__unused__parent: Record<string, unknown>, { pubkey, signature }: { pubkey: string, signature: string }): Promise<AccessToken> => {
            // refine the public-key parameter from browser
            pubkey = pubkey.replace(/\\n/g, '\n');

            /* Validate the signature with the public key */
            if (!await pubkeycrypto.rsaverifier(pubkey, signature)) {
                throw new GraphQLError('Signature vs Public key mismatched.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
            }

            const pubkeyrec = await db.collections!.pubkeys_collection.findOne({ pubkey, deleted: null });
            if (pubkeyrec === null || pubkeyrec === undefined) {
                throw new GraphQLError('This public-key has not been registered yet!', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
            }

            // payload of the JWT for storing user information
            const payload = {
                publicKey: pubkeyrec.jwtPubkey,
                associatedUserId: pubkeyrec.associatedUserId,
                refreshCounter: pubkeyrec.refreshCounter,
                Issuer: 'IDEA-FAST DMP'
            };

            // update the counter
            const fieldsToUpdate = {
                refreshCounter: (pubkeyrec.refreshCounter + 1)
            };
            const updateResult = await db.collections!.pubkeys_collection.findOneAndUpdate({ pubkey, deleted: null }, { $set: fieldsToUpdate }, { returnDocument: 'after' });
            if (updateResult === null) {
                throw new GraphQLError('Server error; cannot fulfil the JWT request.');
            }
            // return the acccess token
            const accessToken = {
                accessToken: pubkeycrypto.tokengen(payload, pubkeyrec.jwtSeckey)
            };

            return accessToken;
        },

        registerPubkey: async (__unused__parent: Record<string, unknown>, { pubkey, signature, associatedUserId }: { pubkey: string, signature: string, associatedUserId: string }, context: any): Promise<IPubkey> => {
            // refine the public-key parameter from browser
            pubkey = pubkey.replace(/\\n/g, '\n');
            const alreadyExist = await db.collections!.pubkeys_collection.findOne({ pubkey, deleted: null });
            if (alreadyExist !== null && alreadyExist !== undefined) {
                throw new GraphQLError('This public-key has already been registered.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
            }

            const requester: IUser = context.req.user;
            /* Check whether requester is the same as the associated user*/
            if (associatedUserId && (requester.id !== associatedUserId)) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* Validate the signature with the public key */
            try {
                const signature_verifier = await pubkeycrypto.rsaverifier(pubkey, signature);
                if (!signature_verifier) {
                    throw new GraphQLError('Signature vs Public-key mismatched.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
                }
            } catch (error) {
                throw new GraphQLError('Error: Signature or Public-key is incorrect.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
            }

            /* Generate a public key-pair for generating and authenticating JWT access token later */
            const keypair = pubkeycrypto.rsakeygen();

            /* Update the new public key if the user is already associated with another public key*/
            if (associatedUserId) {
                const alreadyRegistered = await db.collections!.pubkeys_collection.findOne({ associatedUserId, deleted: null });
                if (alreadyRegistered !== null && alreadyRegistered !== undefined) {
                    //updating the new public key.
                    const fieldsToUpdate = {
                        pubkey,
                        jwtPubkey: keypair.publicKey,
                        jwtSeckey: keypair.privateKey
                    };
                    const updateResult = await db.collections!.pubkeys_collection.findOneAndUpdate({ associatedUserId, deleted: null }, { $set: fieldsToUpdate }, { returnDocument: 'after' });
                    if (updateResult) {
                        await mailer.sendMail({
                            from: `${config.appName} <${config.nodemailer.auth.user}>`,
                            to: requester.email,
                            subject: `[${config.appName}] New public-key has sucessfully registered!`,
                            html: `
                                <p>
                                    Dear ${requester.firstname},
                                <p>
                                <p>
                                    Your new public-key "${pubkey}" on ${config.appName} has successfully registered !<br/>
                                    The old one is already wiped out!
                                    You will need to keep your new private key secretly. <br/>
                                    You will also need to sign a message (using this new public-key) to authenticate the owner of the public key. <br/>
                                </p>
                                
                                <br/>
                                <p>
                                    The ${config.appName} Team.
                                </p>
                            `
                        });

                        return updateResult;
                    } else {
                        throw new GraphQLError('Server error; no entry or more than one entry has been updated.');
                    }
                }
            }

            /* Register new public key (either associated with an user or not) */
            const registeredPubkey = await userCore.registerPubkey({
                pubkey,
                jwtPubkey: keypair.publicKey,
                jwtSeckey: keypair.privateKey,
                associatedUserId: associatedUserId ?? null
            });

            await mailer.sendMail({
                from: `${config.appName} <${config.nodemailer.auth.user}>`,
                to: requester.email,
                subject: `[${config.appName}] Public-key Registration!`,
                html: `
                    <p>
                        Dear ${requester.firstname},
                    <p>
                    <p>
                        You have successfully registered your public-key "${pubkey}" on ${config.appName}!<br/>
                        You will need to keep your private key secretly. <br/>
                        You will also need to sign a message (using your public-key) to authenticate the owner of the public key. <br/>
                    </p>
                    
                    <br/>
                    <p>
                        The ${config.appName} Team.
                    </p>
                `
            });

            return registeredPubkey;
        }
    },

    Subscription: {}
};

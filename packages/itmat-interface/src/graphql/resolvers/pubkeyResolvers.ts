import { ApolloError, UserInputError } from 'apollo-server-express';
//import bcrypt from 'bcrypt';
//import crypto from 'crypto';
import { mailer } from '../../emailer/emailer';
import {
    //Models,
    //Logger,
    IUser,
    //IUserWithoutToken,
    IPubkey
} from 'itmat-commons';
//import { v4 as uuid } from 'uuid';
//import mongodb from 'mongodb';
import { db } from '../../database/database';
import config from '../../utils/configManager';
import { userCore } from '../core/userCore';
import { errorCodes } from '../errors';
//import { makeGenericReponse, IGenericResponse } from '../responses';
import * as mfa from '../../utils/mfa';
import * as pubkeycrypto from '../../utils/pubkeycrypto';


export const pubkeyResolvers = {
    Query: {
        getPubkeys: async (__unused__parent: Record<string, unknown>, args: any): Promise<IPubkey[]> => {
            // everyone is allowed to see all organisations in the app.
            const queryObj = args.pubkeyId === undefined ? { deleted: null } : { deleted: null, id: args.pubkeyId };
            const cursor = db.collections!.pubkeys_collection.find<IPubkey>(queryObj, { projection: { _id: 0 } });
            return cursor.toArray();
        }
    },

    Mutation: {
        registerPubkey: async (__unused__parent: Record<string, unknown>, { pubkey, signature, associatedUserId }: { pubkey: string, signature: string, associatedUserId: string }, context: any): Promise<IPubkey> => {
            const alreadyExist = await db.collections!.pubkeys_collection.findOne({ pubkey, deleted: null });
            if (alreadyExist !== null && alreadyExist !== undefined) {
                throw new UserInputError('This public-key has already been registered.');
            }

            const requester: IUser = context.req.user;
            /* check whether requester is the same as the associated user*/
            if (associatedUserId && (requester.id !== associatedUserId)) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            // /* Validate the signature with the public key */
            if (!pubkeycrypto.rsaverifier(pubkey.replace(/\\n/g, '\n'), signature)) {
                throw new UserInputError('Signature vs Public key mismatched.');
            }

            /* Generate a secret (base32 with default length = 20) for generating JWT access token later */
            const jwtSecret = mfa.generateSecret();

            const registeredPubkey = await userCore.registerPubkey({
                pubkey,
                jwtSecret,
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

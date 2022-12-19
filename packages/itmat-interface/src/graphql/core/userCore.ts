import bcrypt from 'bcrypt';
import { db } from '../../database/database';
import config from '../../utils/configManager';
import { GraphQLError } from 'graphql';
import { IUser, IUserWithoutToken, userTypes, IOrganisation, IPubkey } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { errorCodes } from '../errors';
import { MarkOptional } from 'ts-essentials';

export class UserCore {
    public async getOneUser_throwErrorIfNotExists(username: string): Promise<IUser> {
        const user = await db.collections!.users_collection.findOne({ deleted: null, username });
        if (user === undefined || user === null) {
            throw new GraphQLError('User does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        return user;
    }

    public async createUser(user: { password: string, otpSecret: string, username: string, organisation: string, type: userTypes, description: string, firstname: string, lastname: string, email: string, emailNotificationsActivated: boolean }): Promise<IUserWithoutToken> {
        const { password, otpSecret, organisation, username, type, description, firstname, lastname, email, emailNotificationsActivated } = user;
        const hashedPassword: string = await bcrypt.hash(password, config.bcrypt.saltround);
        const createdAt = Date.now();
        const expiredAt = Date.now() + 86400 * 1000 /* millisec per day */ * 90;
        const entry: IUser = {
            id: uuid(),
            username,
            otpSecret,
            type,
            description,
            organisation,
            firstname,
            lastname,
            password: hashedPassword,
            email,
            emailNotificationsActivated,
            createdAt,
            expiredAt,
            resetPasswordRequests: [],
            deleted: null
        };

        const result = await db.collections!.users_collection.insertOne(entry);
        if (result.acknowledged) {
            const cleared: MarkOptional<IUser, 'password' | 'otpSecret'> = { ...entry };
            delete cleared['password'];
            delete cleared['otpSecret'];
            return cleared;
        } else {
            throw new GraphQLError('Database error', { extensions: { code: errorCodes.DATABASE_ERROR } });
        }
    }

    public async deleteUser(userId: string): Promise<void> {
        const session = db.client!.startSession();
        session.startTransaction();
        try {
            /* delete the user */
            await db.collections!.users_collection.findOneAndUpdate({ id: userId, deleted: null }, { $set: { deleted: new Date().valueOf(), password: 'DeletedUserDummyPassword' } }, { returnDocument: 'after', projection: { deleted: 1 } });

            /* delete all user records in roles related to the study */
            await db.collections!.roles_collection.updateMany(
                {
                    deleted: null,
                    users: userId
                },
                {
                    $pull: { users: { _id: userId } }
                }
            );

            await session.commitTransaction();
            session.endSession();
        } catch (error) {
            // If an error occurred, abort the whole transaction and
            // undo any changes that might have happened
            await session.abortTransaction();
            session.endSession();
            throw new GraphQLError(`Database error: ${JSON.stringify(error)}`);
        }
    }

    public async createOrganisation(org: { name: string, shortname: string | null, containOrg: string | null, metadata: any }): Promise<IOrganisation> {
        const { name, shortname, containOrg, metadata } = org;
        const entry: IOrganisation = {
            id: uuid(),
            name,
            shortname,
            containOrg,
            deleted: null,
            metadata: metadata?.siteIDMarker ? {
                siteIDMarker: metadata.siteIDMarker
            } : {}
        };
        const result = await db.collections!.organisations_collection.findOneAndUpdate({ name: name, deleted: null }, {
            $set: entry
        }, {
            upsert: true
        });
        if (result.ok) {
            return entry;
        } else {
            throw new GraphQLError('Database error', { extensions: { code: errorCodes.DATABASE_ERROR } });
        }
    }

    public async registerPubkey(pubkeyobj: { pubkey: string, associatedUserId: string | null, jwtPubkey: string, jwtSeckey: string }): Promise<IPubkey> {
        const { pubkey, associatedUserId, jwtPubkey, jwtSeckey } = pubkeyobj;
        const entry: IPubkey = {
            id: uuid(),
            pubkey,
            associatedUserId,
            jwtPubkey,
            jwtSeckey,
            refreshCounter: 0,
            deleted: null
        };

        const result = await db.collections!.pubkeys_collection.insertOne(entry);
        if (result.acknowledged) {
            return entry;
        } else {
            throw new GraphQLError('Database error', { extensions: { code: errorCodes.DATABASE_ERROR } });
        }
    }
}

export const userCore = Object.freeze(new UserCore());

import bcrypt from 'bcrypt';
import { db } from '../../database/database';
import config from '../../utils/configManager';
import { ApolloError } from 'apollo-server-core';
import { IUser, IUserWithoutToken, userTypes, Models } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { errorCodes } from '../errors';

export class UserCore {
    public async getOneUser_throwErrorIfNotExists(username: string): Promise<IUser> {
        const user = await db.collections!.users_collection.findOne({ deleted: null, username });
        if (user === undefined || user === null) {
            throw new ApolloError('User does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return user;
    }

    public async createUser(user: { password: string, otpSecret: string, username: string, organisation: string, type: userTypes, description: string, realName: string, email: string, emailNotificationsActivated: boolean }): Promise<IUserWithoutToken> {
        const { password, otpSecret, organisation, username, type, description, realName, email, emailNotificationsActivated } = user;
        const hashedPassword: string = await bcrypt.hash(password, config.bcrypt.saltround);
        const createdAt = Date.now();
        const expiredAt = Date.now() + 86400 * 1000 /* millisec per day */;
        const entry: Models.UserModels.IUser = {
            id: uuid(),
            username,
            otpSecret,
            type,
            description,
            organisation,
            realName,
            password: hashedPassword,
            email,
            emailNotificationsActivated,
            createdAt,
            expiredAt,
            resetPasswordRequests: [],
            deleted: null
        };

        const result = await db.collections!.users_collection.insertOne(entry);
        if (result.result.ok === 1) {
            const cleared: IUserWithoutToken = { ...entry };
            delete cleared['password'];
            return cleared;
        } else {
            throw new ApolloError('Database error', errorCodes.DATABASE_ERROR);
        }
    }

    public async deleteUser(userId: string): Promise<void> {
        const session = db.client.startSession();
        session.startTransaction();
        try {
            /* delete the user */
            await db.collections!.users_collection.findOneAndUpdate({ id: userId, deleted: null }, { $set: { deleted: new Date().valueOf(), password: 'DeletedUserDummyPassword' } }, { returnOriginal: false, projection: { deleted: 1 } });

            /* delete all user records in roles related to the study */
            await db.collections!.roles_collection.updateMany(
                {
                    deleted: null,
                    users: userId
                },
                {
                    $pull: { users: userId }
                }
            );

            await session.commitTransaction();
            session.endSession();
        } catch (error) {
            // If an error occurred, abort the whole transaction and
            // undo any changes that might have happened
            await session.abortTransaction();
            session.endSession();
            throw new ApolloError(`Database error: ${JSON.stringify(error)}`);
        }
    }
}

export const userCore = Object.freeze(new UserCore());

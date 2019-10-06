import bcrypt from 'bcrypt';
import { Models } from 'itmat-utils';
import { db } from '../../database/database';
import config from '../../utils/configManager';

import { ApolloError } from 'apollo-server-core';
import { IUser, IUserWithoutToken, userTypes } from 'itmat-utils/dist/models/user';
import uuidv4 from 'uuid/v4';
import { errorCodes } from '../errors';

export class UserCore {
    public async getOneUser_throwErrorIfNotExists(username: string): Promise<IUser> {
        const user = await db.collections!.users_collection.findOne({ deleted: false, username });
        if (user === undefined || user === null) {
            throw new ApolloError('User does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return user;
    }

    public async createUser(requester: string, user: { password: string, username: string, organisation: string, type: userTypes, description: string, realName: string, email: string, emailNotificationsActivated: boolean }): Promise<IUserWithoutToken> {
        const { password, organisation, username, type, description, realName, email, emailNotificationsActivated } = user;
        const hashedPassword: string = await bcrypt.hash(password, config.bcrypt.saltround);
        const entry: Models.UserModels.IUser = {
            id: uuidv4(),
            username,
            type,
            description,
            organisation,
            realName,
            password: hashedPassword,
            createdBy: requester,
            email,
            emailNotificationsActivated,
            deleted: false
        };

        const result = await db.collections!.users_collection.insertOne(entry);
        if (result.result.ok === 1) {
            delete entry.password;
            return entry;
        } else {
            throw new ApolloError('Database error', errorCodes.DATABASE_ERROR);
        }
    }

    public async deleteUser(userId: string) {
        const result = await db.collections!.users_collection.findOneAndUpdate({ id: userId, deleted: false }, { $set: { deleted: true, password: 'DeletedUserDummyPassword' } }, { returnOriginal: false, projection: { deleted: 1 } });
        if (result.ok !== 1 || result.value.deleted !== true) {
            throw new ApolloError(`Database error: ${JSON.stringify(result.lastErrorObject)}`, errorCodes.DATABASE_ERROR);
        }
        return;
    }




}

export const userCore = Object.freeze(new UserCore());

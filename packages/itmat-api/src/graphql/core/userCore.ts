import mongodb from 'mongodb';
import bcrypt from 'bcrypt';
import { db } from '../../database/database';
import { permissions, Models } from 'itmat-utils';
import config from '../../../config/config.json';

import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy, IRole } from 'itmat-utils/dist/models/study';
import { errorCodes } from '../errors';
import uuidv4 from 'uuid/v4';
import { IUser, userTypes, IUserWithoutToken, IShortCut } from 'itmat-utils/dist/models/user';
import { PermissionCore, permissionCore } from './permissionCore';

export class UserCore {
    async getOneUser_throwErrorIfNotExists(username: string): Promise<IUser> {
        const user = await db.collections!.users_collection.findOne({ deleted: false, username });
        if (user === undefined || user === null) {
            throw new ApolloError('User does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return user;
    }

    async addShortCutToUser(username: string, study: string, project?: string): Promise<IUserWithoutToken> {
        const shortcut: IShortCut = {
            id: uuidv4(),
            project,
            study
        };
        const result = await db.collections!.users_collection.findOneAndUpdate({ username, deleted: false }, { $push: { shortcuts: shortcut } }, { returnOriginal: false, projection: { _id: 0, password: 0, deleted: 0 } });
        if (result.ok !== 1) {
            throw new ApolloError('Error in creating shortcut.', errorCodes.DATABASE_ERROR);
        }
        return result.value;
    }

    async removeShortCutFromUser(username: string, shortCutId: string): Promise<IUserWithoutToken> {
        const result = await db.collections!.users_collection.findOneAndUpdate({ username, deleted: false }, { $pull: { shortcuts: { id: shortCutId }} }, { returnOriginal: false, projection: { _id: 0, password: 0, deleted: 0 } });
        if (result.ok !== 1) {
            throw new ApolloError('Error in creating shortcut.', errorCodes.DATABASE_ERROR);
        }
        return result.value;
    }

    async createUser(requester: string, user: { password: string, username: string, type: userTypes, description?: string, realName: string, email: string, emailNotificationsActivated: boolean }): Promise<IUserWithoutToken> {
        const { password, username, type, description, realName, email, emailNotificationsActivated } = user;
        const hashedPassword: string = await bcrypt.hash(password, config.bcrypt.saltround);
        const entry: Models.UserModels.IUser = {
            id: uuidv4(),
            shortcuts: [],
            username,
            type,
            description: description === undefined ? '' : description,
            realName,
            password: hashedPassword,
            createdBy: requester,
            email,
            notifications: [],
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

    async deleteUser(username: string) {
        const result = await db.collections!.users_collection.findOneAndUpdate({ username, deleted: false }, { $set: { deleted: true, password: 'DeletedUserDummyPassword' } }, { returnOriginal: false, projection: { deleted: 1 } });
        if (result.ok !== 1 || result.value.deleted !== false) {
            throw new ApolloError(`Database error: ${JSON.stringify(result.lastErrorObject)}`, errorCodes.DATABASE_ERROR);
        }
        return;
    }




}

export const userCore = Object.freeze(new UserCore());
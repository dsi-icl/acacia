import { Models } from 'itmat-commons';
import mongodb from 'mongodb';
import { db } from '../database/database';

export class UserLoginUtils {
    constructor() {
        this.serialiseUser = this.serialiseUser.bind(this);
        this.deserialiseUser = this.deserialiseUser.bind(this);
    }

    public serialiseUser(user: Models.UserModels.IUser, done: Function): void {
        done(null, user.username);
    }

    public async deserialiseUser(username: string, done: Function): Promise<void> {
        const user: Models.UserModels.IUserWithoutToken = await this._getUser(username);
        done(null, user);
    }

    private async _getUser(username: string): Promise<Models.UserModels.IUserWithoutToken> {
        return await db.collections!.users_collection.findOne({ deleted: false, username }, { projection: { _id: 0, deleted: 0, password: 0 } })!;
    }
}

export const userLoginUtils = Object.freeze(new UserLoginUtils());
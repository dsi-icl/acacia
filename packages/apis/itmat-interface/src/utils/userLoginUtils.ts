import { IUser, IUserWithoutToken } from '@itmat/commons';
import { db } from '../database/database';

export class UserLoginUtils {
    constructor() {
        this.serialiseUser = this.serialiseUser.bind(this);
        this.deserialiseUser = this.deserialiseUser.bind(this);
    }

    public serialiseUser(user: IUser, done: (target, username) => void): void {
        done(null, user.username);
    }

    public async deserialiseUser(username: string, done: (target, username) => void): Promise<void> {
        const user: IUserWithoutToken = await this._getUser(username);
        done(null, user);
    }

    private async _getUser(username: string): Promise<IUserWithoutToken> {
        return await db.collections!.users_collection.findOne({ deleted: null, username }, { projection: { _id: 0, deleted: 0, password: 0 } })!;
    }
}

export const userLoginUtils = Object.freeze(new UserLoginUtils());

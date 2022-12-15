import { IUser, IUserWithoutToken } from '@itmat-broker/itmat-types';
import { db } from '../database/database';

export class UserLoginUtils {
    constructor() {
        this.serialiseUser = this.serialiseUser.bind(this);
        this.deserialiseUser = this.deserialiseUser.bind(this);
    }

    public serialiseUser(user: Express.User, done: (__unused__err: any, __unused__id?: any) => void): void {
        done(null, (user as IUser).username);
    }

    public async deserialiseUser(username: string, done: (__unused__err: any, __unused__id?: any) => void): Promise<void> {
        const user = await this._getUser(username);
        done(null, user);
    }

    private async _getUser(username: string): Promise<IUserWithoutToken | null> {
        return await db.collections!.users_collection.findOne<IUserWithoutToken>({ deleted: null, username }, { projection: { _id: 0, deleted: 0, password: 0 } })!;
    }
}

export const userLoginUtils = Object.freeze(new UserLoginUtils());

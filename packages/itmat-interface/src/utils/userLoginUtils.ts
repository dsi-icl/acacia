import { IUser, IUserWithoutToken } from '@itmat-broker/itmat-types';
import { db } from '../database/database';

export class UserLoginUtils {
    constructor() {
        this.serialiseUser = this.serialiseUser.bind(this);
        this.deserialiseUser = this.deserialiseUser.bind(this);
    }

    public serialiseUser(user: Express.User, done: (__unused__err: unknown, __unused__id: string) => void) {
        done(null, (user as IUser).username);
    }

    public deserialiseUser(username: string, done: (__unused__err: unknown, __unused__id: IUserWithoutToken | null) => void) {
        this._getUser(username)
            .then(user => {
                done(null, user);
            })
            .catch(() => { return; });
    }

    private async _getUser(username: string): Promise<IUserWithoutToken | null> {
        return await db.collections.users_collection.findOne<IUserWithoutToken>({ deleted: null, username }, { projection: { _id: 0, deleted: 0, password: 0 } });
    }
}

export const userLoginUtils = Object.freeze(new UserLoginUtils());

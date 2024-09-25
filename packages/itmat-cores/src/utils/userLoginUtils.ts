import { IUser, IUserWithoutToken } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';

export class UserLoginUtils {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
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
        return await this.db.collections.users_collection.findOne<IUserWithoutToken>({ 'life.deletedTime': null, username }, { projection: { '_id': 0, 'life.deletedTime': 0, 'password': 0 } });
    }
}

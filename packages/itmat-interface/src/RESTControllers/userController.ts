import { Models } from 'itmat-utils';
import mongodb from 'mongodb';


export class UserController {
    constructor(private readonly usersCollection: mongodb.Collection) {
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
        return await this.usersCollection.findOne({ deleted: false, username }, { projection: { _id: 0, deleted: 0, password: 0 }})!;
    }
}

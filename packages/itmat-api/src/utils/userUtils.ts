import { APIDatabase } from '../database/database';
import mongodb from 'mongodb';
import { userTypes } from 'itmat-utils';



export interface UserWithoutToken {
    _id?: mongodb.ObjectId,
    username: string,
    type: keyof typeof userTypes,
    deleted?: boolean,
    createdBy: string
}

export interface User extends UserWithoutToken {
    password: string,  //password
}


/* all the authorization and injection attacks are checked prior, so everything here is assumed to be 'clean' */ 
/* checking for null result is not done here but in controllers */ 
export class UserUtils {
    public static async getAllUsers(): Promise<UserWithoutToken[]> {
        const cursor: mongodb.Cursor = APIDatabase.users_collection.find({ deleted: false }, { projection: { password: 0, _id: 0, createdBy: 0 }});
        return await cursor.toArray();
    }

    public static async getUser(username: string): Promise<UserWithoutToken> {
        return await APIDatabase.users_collection.findOne({ deleted: false, username }, { projection: { _id: 0, deleted: 0, password: 0 }});
    }

    public static async createNewUser(user: User): Promise<mongodb.InsertOneWriteOpResult> {
        user.deleted = false;
        return await APIDatabase.users_collection.insertOne(user);
    }

    public static serialiseUser(user: User, done: Function): void {
        done(null, user.username);
    }

    public static async deserialiseUser(username: string, done: Function): Promise<void> {
        const user: UserWithoutToken = await UserUtils.getUser(username);
        done(null, user);
    }

}
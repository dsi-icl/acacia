import { APIDatabase } from '../database/database';
import mongodb from 'mongodb';
import { CustomError } from 'itmat-utils';
import config from '../config/config.json';
import bcrypt from 'bcrypt';

export interface UserWithoutToken {
    _id: mongodb.ObjectId,
    username: string,
    type: string, //'ADMIN'
    deleted?: boolean,
    createdBy: string
}

export interface User extends UserWithoutToken {
    token: string,  //password
}


/* all the authorization and injection attacks are checked prior, so everything here is assumed to be 'clean' */ 
/* checking for null result is not done here but in controllers */ 
export class UserUtils {
    public static async getAllUsers(): Promise<UserWithoutToken[]> {
        const cursor: mongodb.Cursor = APIDatabase.users_collection.find({ deleted: false }, { projection: { token: -1, _id: -1, createdBy: -1 }});
        return await cursor.toArray();
    }

    public static async getUser(username: string): Promise<UserWithoutToken> {
        return await APIDatabase.users_collection.findOne({ deleted: false, username }, { projection: { token: -1 }});
    }

    public static async createNewUser(user: User): Promise<object> {
        user.deleted = false;
        return await APIDatabase.users_collection.insertOne(user);
    }

    // public static async login(req) {
    //     const result: User = await APIDatabase.users_collection.findOne({ deleted: false, username });
    //     if (!result) {
    //         return done(null, false, new CustomError('Incorrect username'));
    //     }
    //     // const passwordMatched = await bcrypt.compare(password, result.token);
    //     const passwordMatched = password === result.token;
    //     if (!passwordMatched) {
    //         return done(null, false, new CustomError('Incorrect password'));
    //     }
    //     return done(null, result);
    // }

    public static serialiseUser(user: User, done: Function): void {
        done(null, user.username);
    }

    public static async deserialiseUser(username: string, done: Function): Promise<void> {
        const user: UserWithoutToken = await this.getUser(username);
        done(null, user);
    }


    // public static async updateUser(username: string, newEntry: User): Promise<object> {
    //     const user = await APIDatabase.users_collection.findOne({ username, deleted: false });
    //     if (user === null) {
    //         return { nModified: 0 };
    //     }

    //     await APIDatabase.users_collection.updateOne({ username }, { $set: { deleted: true }});
    //     APIDatabase.users_collection.updateOne()
    // }

}
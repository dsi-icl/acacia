import mongodb, { UpdateWriteOpResult, Collection } from 'mongodb';
import { Models } from 'itmat-utils';
import { server } from '../index';





/* all the authorization and injection attacks are checked prior, so everything here is assumed to be 'clean' */ 
/* checking for null result is not done here but in controllers */ 
export class UserUtils {
    public static async getAllUsers(): Promise<Models.UserModels.IUserWithoutToken[]> {
        const cursor: mongodb.Cursor = (server.db.users_collection as Collection).find({ deleted: false }, { projection: { password: 0, _id: 0, createdBy: 0 }});
        return await cursor.toArray();
    }

    public static async getUser(username: string): Promise<Models.UserModels.IUserWithoutToken> {
        return await (server.db.users_collection as Collection).findOne({ deleted: false, username }, { projection: { _id: 0, deleted: 0, password: 0 }});
    }

    public static async createNewUser(user: Models.UserModels.IUser): Promise<mongodb.InsertOneWriteOpResult> {
        user.deleted = false;
        return await (server.db.users_collection as Collection).insertOne(user);
    }

    public static async deleteUser(username: string): Promise<UpdateWriteOpResult> {
        return await (server.db.users_collection as Collection).updateOne( { deleted: false, username }, { $set: { deleted: true }});
    }

    public static serialiseUser(user: Models.UserModels.IUser, done: Function): void {
        done(null, user.username);
    }

    public static async deserialiseUser(username: string, done: Function): Promise<void> {
        const user: Models.UserModels.IUserWithoutToken = await UserUtils.getUser(username);
        done(null, user);
    }

}
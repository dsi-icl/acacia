import { UserInputError, ForbiddenError, ApolloError } from 'apollo-server-express';
import { Database } from '../../database/database';
import { Models, Logger } from 'itmat-utils';
import config from '../../../config/config.json';
import mongodb from 'mongodb';
import bcrypt from 'bcrypt';
import uuidv4 from 'uuid/v4';
import { makeGenericReponse } from '../responses';
import { IUser, IShortCut } from 'itmat-utils/dist/models/user';
import { studyCore } from '../core/studyCore';
import { userCore } from '../core/userCore';

export const userResolvers = {
    Query: {
        whoAmI(parent: object, args: any, context: any, info: any): object {
            return context.req.user;
        },
        getUsers: async(parent: object, args: any, context: any, info: any): Promise<IUser[]> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            // if (requester.type !== Models.UserModels.userTypes.ADMIN) {
            //     throw new ForbiddenError('Unauthorised.');
            // }
            const queryObj = args.username === undefined ? { deleted: false } : { deleted: false, username: args.username };
            const cursor = db.collections!.users_collection.find(queryObj);
            return cursor.toArray();
        }
    },
    Mutation: {
        login: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const { db, req }: { db: Database, req: Express.Request } = context;
            const result = await db.collections!.users_collection.findOne({ deleted: false, username: args.username });
            if (!result) {
                throw new UserInputError('User does not exist.');
            }
            const passwordMatched = await bcrypt.compare(args.password, result.password);
            if (!passwordMatched) {
                throw new UserInputError('Incorrect password.');
            }
            delete result.password;
            delete result.deleted;

            return new Promise(resolve => {
                req.login(result, (err: any) => {
                    if (err) {
                        Logger.error(err);
                        throw new ApolloError('Cannot log in. Please try again later.');
                    }
                    resolve(result);
                });
            });
        },
        logout: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const req: Express.Request = context.req;
            if (requester === undefined || requester === null) {
                throw new ApolloError('Not logged in in the first place!');
            }
            return new Promise(resolve => {
                req.session!.destroy(err => {
                    req.logout();
                    if (err) {
                        Logger.error(err);
                        throw new ApolloError('Cannot log out');
                    } else {
                        resolve(makeGenericReponse(context.req.user));
                    }
                });
            });
        },
        addShortCut: async(parent: object, args: { study: string, project?: string }, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { study, project }  = args;

            const modifiedUser = await userCore.addShortCutToUser(requester.username, study, project);
            return modifiedUser;
        },
        removeShortCut: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { shortCutId }: { shortCutId: string } = args;
            const modifiedUser = await userCore.removeShortCutFromUser(requester.username, shortCutId);
            return modifiedUser;
        },
        createUser: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }
            const { username, type, realName, email, emailNotificationsActivated, password, description }: {
                username: string, type: Models.UserModels.userTypes, realName: string, email: string, emailNotificationsActivated: boolean, password: string, description: string
            } = args.user;

            const alreadyExist = await db.collections!.users_collection.findOne({ username, deleted: false }); // since bycrypt is CPU expensive let's check the username is not taken first
            if (alreadyExist !== null && alreadyExist !== undefined) {
                throw new UserInputError('User already exists.');
            }

            const createdUser = await userCore.createUser(requester.username, {
                password,
                username,
                type,
                description,
                realName,
                email,
                emailNotificationsActivated
            });

            return createdUser;
        },
        deleteUser: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }
            await userCore.deleteUser(args.username);
            return makeGenericReponse(args.username);
        },
        editUser: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { username, type, realName, email, emailNotificationsActivated, password }: {
                username: string, type: Models.UserModels.userTypes, realName: string, email: string, emailNotificationsActivated: boolean, password: string
            } = args.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN && requester.username !== username) {
                throw new ForbiddenError('Unauthorised.');
            }
            if (requester.type === Models.UserModels.userTypes.ADMIN) {
                const result: Models.UserModels.IUserWithoutToken = await db.collections!.users_collection.findOne({ username, deleted: false })!;   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
                if (result === null || result === undefined) {
                    throw new ApolloError('User not found');
                }
            }
            if (requester.type !== Models.UserModels.userTypes.ADMIN && type !== undefined) {
                throw new ApolloError('Non-admin users are not authorised to change user type.');
            }

            const fieldsToUpdate: any = {
                type,
                realName,
                email,
                emailNotificationsActivated,
                password
            };
            if (password) { fieldsToUpdate.password = await bcrypt.hash(password, config.bcrypt.saltround); }
            for (const each of Object.keys(fieldsToUpdate)) {
                if (fieldsToUpdate[each] === undefined) {
                    delete fieldsToUpdate[each];
                }
            }

            const updateResult: mongodb.FindAndModifyWriteOpResultObject = await db.collections!.users_collection.findOneAndUpdate({ username, deleted: false }, { $set: fieldsToUpdate }, { returnOriginal: false });
            if (updateResult.ok === 1) {
                return updateResult.value;
            } else {
                throw new ApolloError('Server error; no entry or more than one entry has been updated.');
            }
        }
    },
    Subscription: {}
};
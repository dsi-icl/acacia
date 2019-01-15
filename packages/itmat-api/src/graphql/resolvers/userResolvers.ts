import bcrypt from 'bcrypt';
import { UserInputError, ForbiddenError, ApolloError } from 'apollo-server-express';
import { Database } from '../../database/database';
import { Models, Logger } from 'itmat-utils';
import config from '../../../config/config.json';
import mongodb from 'mongodb';
import uuidv4 from 'uuid/v4';
import { makeGenericReponse } from '../responses';
import { IUser } from 'itmat-utils/dist/models/user';
import { APIModels } from 'itmat-utils/dist/models';

export const userResolvers = {
    Query: {
        whoAmI(parent: object, args: any, context: any, info: any): object {
            return context.req.user;
        },
        getUsers: async(parent: object, args: any, context: any, info: any): Promise<IUser[]> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }
            const queryObj = args.username === undefined ? { deleted: false } : { deleted: false, username: args.username };
            const cursor = db.users_collection!.find(queryObj);
            return cursor.toArray();
        }
    },
    Mutation: {
        login: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const { db, req }: { db: Database, req: Express.Request } = context;
            const result = await db.users_collection!.findOne({ deleted: false, username: args.username });
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
        createUser: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }
            const { username, type, realName, email, emailNotificationsActivated, password, description }: {
                username: string, type: Models.UserModels.userTypes, realName: string, email: string, emailNotificationsActivated: boolean, password: string, description: string
            } = args.user;

            const alreadyExist = await db.users_collection!.findOne({ username, deleted: false }); // since bycrypt is CPU expensive let's check the username is not taken first
            if (alreadyExist !== null && alreadyExist !== undefined) {
                throw new UserInputError('User already exists.');
            }

            const hashedPassword: string = await bcrypt.hash(password, config.bcrypt.saltround);
            const entry: Models.UserModels.IUser = {
                id: uuidv4(),
                username,
                type,
                description: description === undefined ? '' : description,
                realName,
                password: hashedPassword,
                createdBy: requester.username,
                email,
                notifications: [],
                emailNotificationsActivated,
                deleted: false
            };

            const result = await db.users_collection!.insertOne(entry);
            return makeGenericReponse(username);
        },
        deleteUser: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }
            const username: string = args.username;
            const result = await db.users_collection!.updateOne({ username, deleted: false }, { $set: { deleted: true, password: 'DeletedUserDummyPassword' } });

            if (result.result.ok === 1) {
                return makeGenericReponse(username);
            } else {
                throw new ApolloError('Cannot complete operation. Server error.');
            }
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
                const result: Models.UserModels.IUserWithoutToken = await db.users_collection!.findOne({ username, deleted: false })!;   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
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

            const updateResult: mongodb.UpdateWriteOpResult = await db.users_collection!.updateOne({ username, deleted: false }, { $set: fieldsToUpdate });
            if (updateResult.modifiedCount === 1) {
                return makeGenericReponse(username);
            } else {
                throw new ApolloError('Server error; no entry or more than one entry has been updated.');
            }
        }
    }
};
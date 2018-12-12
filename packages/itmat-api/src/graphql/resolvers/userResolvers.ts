import bcrypt from 'bcrypt';
import { UserInputError, ForbiddenError, ApolloError } from 'apollo-server-express';
import { Database } from '../../database/database';
import { Models } from 'itmat-utils';
import config from '../../../config/config.json';
import mongodb from 'mongodb';
import { makeGenericReponse } from '../responses';
import { IUser } from 'itmat-utils/dist/models/user';

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

            const cursor = db.users_collection!.find({ deleted: false });
            return cursor.toArray();
        }
        // getUsers(parent: object, args: any, context: any, info: any): object[] {
        //     // check admin privilege
        //     if (args.username) {

        //     } else {

        //     }
        // },
        // getStudies(parent: object, args: any, context: any, info: any): object[] {
        //     // return only the studies the guy has access to.
        // }
    },
    Mutation: {
        login: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const { db, req }: { db: Database, req: Express.Request } = context;
            const result = await db.users_collection!.findOne({ deleted: false, username: args.username });
            if (!result) {
                throw new UserInputError('User does not exist.');
            }
            const passwordMatched = await bcrypt.compare(args.password, result.password);
            // const passwordMatched = req.body.password === result.password;
            if (!passwordMatched) {
                throw new UserInputError('Incorrect password.');
            }
            delete result.password;
            delete result.deleted;

            return new Promise(resolve => {
                req.login(result, (err: any) => {
                    if (err) { console.log(err); resolve(result); }
                    // res.status(200).json({ message: 'Logged in!' });
                    resolve(result);
                });
            });
        },
        createUser: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }
            const { username, type, realName, email, emailNotificationsActivated, password }: {
                username: string, type: Models.UserModels.userTypes, realName: string, email: string, emailNotificationsActivated: boolean, password: string
            } = args.user;
            console.log(args, username, type, realName, email, emailNotificationsActivated, password);

            const alreadyExist = await db.users_collection!.findOne({ username }); // since bycrypt is CPU expensive let's check the username is not taken first
            if (alreadyExist !== undefined && alreadyExist !== null) {
                throw new UserInputError('User already exists.');
            }
            console.log(password, config.bcrypt.saltround);
            const hashedPassword: string = await bcrypt.hash(password, config.bcrypt.saltround);
            const entry: Models.UserModels.IUser = {
                username,
                realName,
                password: hashedPassword,
                type,
                deleted: false,
                createdBy: requester.username,
                email,
                notifications: [],
                emailNotificationsActivated
            };

            const result = await db.users_collection!.insertOne(entry);

            return makeGenericReponse();
        },
        deleteUser: async(parent: object, args: any, context: any, info: any): Promise<object> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }
            const { username }: { username: string } = args;

            const result = await db.users_collection!.updateOne({ username }, { $set: { deleted: false } });

            if (result.result.ok === 1) {
                return makeGenericReponse();
            } else {
                throw new ApolloError('Cannot complete operation. Server error.');
            }
        }
    }
};
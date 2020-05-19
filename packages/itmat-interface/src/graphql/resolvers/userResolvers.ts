import { ApolloError, UserInputError } from 'apollo-server-express';
import bcrypt from 'bcrypt';
import { mailer } from '../../emailer/emailer';
import { Models } from 'itmat-commons';
import { IProject, IRole, IStudy } from 'itmat-commons/dist/models/study';
import { IUser, userTypes } from 'itmat-commons/dist/models/user';
import { Logger } from 'itmat-utils';
import { v4 as uuid } from 'uuid';
import mongodb from 'mongodb';
import { db } from '../../database/database';
import config from '../../utils/configManager';
import { userCore } from '../core/userCore';
import { errorCodes } from '../errors';
import { makeGenericReponse } from '../responses';

export const userResolvers = {
    Query: {
        whoAmI(parent: object, args: any, context: any, info: any): object {
            return context.req.user;
        },
        getUsers: async (parent: object, args: any, context: any, info: any): Promise<IUser[]> => {
            const requester: Models.UserModels.IUser = context.req.user;

            // everyone is allowed to see all the users in the app. But only admin can access certain fields, like emails, etc - see resolvers for User type.
            const queryObj = args.userId === undefined ? { deleted: null } : { deleted: null, id: args.userId };
            const cursor = db.collections!.users_collection.find(queryObj, { projection: { _id: 0 } });
            return cursor.toArray();
        }
    },
    User: {
        access: async (user: IUser, arg: any, context: any): Promise<{ projects: IProject[], studies: IStudy[], id: string }> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* only admin can access this field */
            if (requester.type !== userTypes.ADMIN && user.id !== requester.id) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* if requested user is admin, then he has access to all studies */
            if (user.type === userTypes.ADMIN) {
                const allprojects: IProject[] = await db.collections!.projects_collection.find({ deleted: null }).toArray();
                const allstudies: IStudy[] = await db.collections!.studies_collection.find({ deleted: null }).toArray();
                return { id: `user_access_obj_user_id_${user.id}`, projects: allprojects, studies: allstudies };
            }

            /* if requested user is not admin, find all the roles a user has */
            const roles: IRole[] = await db.collections!.roles_collection.find({ users: user.id, deleted: null }).toArray();
            const init: { projects: string[], studies: string[] } = { projects: [], studies: [] };
            const studiesAndProjectThatUserCanSee: { projects: string[], studies: string[] } = roles.reduce(
                (a, e) => {
                    if (e.projectId) {
                        a.projects.push(e.projectId);
                    } else {
                        a.studies.push(e.studyId);
                    }
                    return a;
                }, init
            );

            const projects: IProject[] = await db.collections!.projects_collection.find({
                    $or: [
                        { id: { $in: studiesAndProjectThatUserCanSee.projects }, deleted: null },
                        { studyId: { $in: studiesAndProjectThatUserCanSee.studies }, deleted: null }
                    ]
                }).toArray();
            const studies: IStudy[] = await db.collections!.studies_collection.find({ id: { $in: studiesAndProjectThatUserCanSee.studies }, deleted: null }).toArray();
            return { id: `user_access_obj_user_id_${user.id}`, projects, studies };
        },
        username: async (user: IUser, arg: any, context: any): Promise<string | null> => {
            const requester: Models.UserModels.IUser = context.req.user;
            /* only admin can access this field */
            if (context.req.user.type !== userTypes.ADMIN && user.id !== requester.id) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            return user.username;
        },
        description: async (user: IUser, arg: any, context: any): Promise<string | null> => {
            const requester: Models.UserModels.IUser = context.req.user;
            /* only admin can access this field */
            if (context.req.user.type !== userTypes.ADMIN && user.id !== requester.id) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            return user.description;
        },
        email: async (user: IUser, arg: any, context: any): Promise<string | null> => {
            const requester: Models.UserModels.IUser = context.req.user;
            /* only admin can access this field */
            if (context.req.user.type !== userTypes.ADMIN && user.id !== requester.id) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            return user.email;
        }
    },
    Mutation: {
        forgotUsernameOrPassword: async (parent: object, { forgotUsername, forgotPassword, email, username }: { forgotUsername: boolean, forgotPassword: boolean, email?: string, username?: string }, context: any, info: any): Promise<object> => {
            /* checking the args are right */
            if (
                forgotUsername && !email // should provide email if no username
                || forgotUsername && username // should not provide username if it's forgotten..
                || !email && !username
            ) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            } else if (email && username) {
                // TO_DO : better client erro
                /* only provide email if no username */
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }

            /* check user existence */
            const queryObj = email ? { deleted: null, email } : { deleted: null, username };
            const user: IUser | null = await db.collections!.users_collection.findOne(queryObj);
            if (!user) {
                /* even user is null. send successful response: they should know that a user dosen't exist */
                return makeGenericReponse();
            }

            if (forgotPassword) {
                /* make link to change password */
                const passwordResetToken = uuid();
                const updateResult = await db.collections!.users_collection.findOneAndUpdate(
                    { deleted: null, email },
                    { $push: {
                        resetPasswordRequests: {
                            id: passwordResetToken,
                            timeOfRequest: new Date().valueOf()
                        }
                    }}
                );
                if (updateResult.ok !== 1) {
                    throw new ApolloError(errorCodes.DATABASE_ERROR);
                }

                /* send email to client */
                await mailer.sendMail(formatEmailForForgottenPassword({
                    to: user.email,
                    resetPasswordToken: passwordResetToken,
                    username: user.username,
                    realname: user.realName
                }));
            } else {
                /* send email to client */
                await mailer.sendMail(formatEmailForFogettenUsername({
                    to: user.email,
                    username: user.username,
                    realname: user.realName
                }));
            }
            return makeGenericReponse();
        },
        login: async (parent: object, args: any, context: any, info: any): Promise<object> => {
            const { req }: { req: Express.Request } = context;
            const result = await db.collections!.users_collection.findOne({ deleted: null, username: args.username });
            if (!result) {
                throw new UserInputError('User does not exist.');
            }
            const passwordMatched = await bcrypt.compare(args.password, result.password);
            if (!passwordMatched) {
                throw new UserInputError('Incorrect password.');
            }
            delete result.password;
            delete result.deleted;

            return new Promise((resolve) => {
                req.login(result, (err: any) => {
                    if (err) {
                        Logger.error(err);
                        throw new ApolloError('Cannot log in. Please try again later.');
                    }
                    resolve(result);
                });
            });
        },
        logout: async (parent: object, args: any, context: any, info: any): Promise<object> => {
            const requester: Models.UserModels.IUser = context.req.user;
            const req: Express.Request = context.req;
            if (requester === undefined || requester === null) {
                return makeGenericReponse(context.req.user);
            }
            return new Promise((resolve) => {
                req.session!.destroy((err) => {
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
        createUser: async (parent: object, args: any, context: any, info: any): Promise<object> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* only admin can create new users */
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            const { username, type, realName, email, emailNotificationsActivated, password, description, organisation }: {
                username: string, type: Models.UserModels.userTypes, realName: string, email: string, emailNotificationsActivated: boolean, password: string, description: string, organisation: string
            } = args.user;

            /* check email is valid form */
            if (!/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/.test(email)) {
                throw new UserInputError('Email is not the right format.');
            }

            /* check that username and password dont have space */
            if (username.indexOf(' ') !== -1 || password.indexOf(' ') !== -1) {
                throw new UserInputError('Username or password cannot have space.');
            }

            const alreadyExist = await db.collections!.users_collection.findOne({ username, deleted: null }); // since bycrypt is CPU expensive let's check the username is not taken first
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
                organisation,
                emailNotificationsActivated
            });

            return createdUser;
        },
        deleteUser: async (parent: object, args: any, context: any, info: any): Promise<object> => {
            /* only admin can delete users */
            const requester: Models.UserModels.IUser = context.req.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }
            await userCore.deleteUser(args.userId);
            return makeGenericReponse(args.userId);
        },
        editUser: async (parent: object, args: any, context: any, info: any): Promise<object> => {
            const requester: Models.UserModels.IUser = context.req.user;
            const { id, username, type, realName, email, emailNotificationsActivated, password, description, organisation }: {
                id: string, username?: string, type?: Models.UserModels.userTypes, realName?: string, email?: string, emailNotificationsActivated?: boolean, password?: string, description?: string, organisation?: string
            } = args.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN && requester.id !== id) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }
            if (requester.type === Models.UserModels.userTypes.ADMIN) {
                const result: Models.UserModels.IUserWithoutToken = await db.collections!.users_collection.findOne({ id, deleted: null })!;   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
                if (result === null || result === undefined) {
                    throw new ApolloError('User not found');
                }
            }
            // if (requester.type !== Models.UserModels.userTypes.ADMIN && type !== undefined) {
                // throw new ApolloError('Non-admin users are not authorised to change user type.');
            // }

            const fieldsToUpdate: any = {
                type,
                realName,
                username,
                email,
                emailNotificationsActivated,
                password,
                description,
                organisation
            };

            /* check email is valid form */
            if (email && !/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/.test(email)) {
                throw new UserInputError('User not updated: Email is not the right format.');
            }

            if (requester.type !== Models.UserModels.userTypes.ADMIN && (
                type || realName || username || description || organisation
            )) {
                throw new ApolloError('User not updated: Non-admin users are only authorised to change their password or email.');
            }

            if (password) { fieldsToUpdate.password = await bcrypt.hash(password, config.bcrypt.saltround); }
            for (const each of Object.keys(fieldsToUpdate)) {
                if (fieldsToUpdate[each] === undefined) {
                    delete fieldsToUpdate[each];
                }
            }
            const updateResult: mongodb.FindAndModifyWriteOpResultObject<any> = await db.collections!.users_collection.findOneAndUpdate({ id, deleted: null }, { $set: fieldsToUpdate }, { returnOriginal: false });
            if (updateResult.ok === 1) {
                return updateResult.value;
            } else {
                throw new ApolloError('Server error; no entry or more than one entry has been updated.');
            }
        }
    },
    Subscription: {}
};


function formatEmailForForgottenPassword({ realname, username, to, resetPasswordToken }: { resetPasswordToken: string, to: string, username: string, realname: string }) {
    const link = `${config.useSSL ? 'https' : 'http'}://${config.host}/resetPassword?username=${username}&token=${resetPasswordToken}</p>`;
    return ({
        from: 'NAME',
        to,
        subject: 'Reset your NAME password',
        html: `<p>Dear ${realname},<p>
            <br/><br/>
            <p>Your username is <b>${username}</b>.</p><br/><br/>
            <p>You can reset you password by click the following link (active for 1 hour):</p>
            <p><a href=${link}>${link}</a></p>
            <br/><br/>

            Yours truly,
            NAME team.
        `
    });
}

function formatEmailForFogettenUsername({ username, to, realname }: { username: string, to: string, realname: string}) {
    return ({
        from: 'NAME',
        to,
        subject: 'Your NAME username reminder',
        html: `<p>Dear ${realname},<p>
            <br/><br/>
            <p>Your username is <b>${username}</b>.</p><br/><br/>

            Yours truly,
            NAME team.
        `
    });
}
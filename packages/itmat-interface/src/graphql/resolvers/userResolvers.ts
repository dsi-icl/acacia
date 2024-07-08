import { CoreError, IUserWithoutToken, enumUserTypes } from '@itmat-broker/itmat-types';
import { GraphQLErrorDecroator, TRPCPermissionCore, TRPCUserCore, V2CreateUserInput, V2EditUserInput, errorCodes, makeGenericReponse } from '@itmat-broker/itmat-cores';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { mailer } from '../../emailer/emailer';
import config from '../../utils/configManager';
import { objStore } from '../../objStore/objStore';
import { GraphQLError } from 'graphql';

const userCore = new TRPCUserCore(db, mailer, config, objStore);
const permissionCore = new TRPCPermissionCore(db);

export const userResolvers: DMPResolversMap = {
    Query: {
        whoAmI: (_parent, _args, context) => {
            try {
                if (context.req.user) {
                    return {
                        ...context.req.user,
                        createdAt: context.req.user?.life.createdTime,
                        deleted: context.req.user?.life.deletedTime
                    };
                } else {
                    throw new GraphQLError(errorCodes.NOT_LOGGED_IN);
                }
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        getUsers: async (_parent, args: { userId?: string }, context) => {
            try {
                const users = args.userId ? [await userCore.getUser(context.req.user, args.userId)] : await userCore.getUsers(context.req.user);
                const decroatedUsers = users.map(user => {
                    if (!user) return null;

                    return {
                        id: user.id,
                        username: user.username,
                        type: user.type,
                        firstname: user.firstname,
                        lastname: user.lastname,
                        email: user.email,
                        emailNotificationsActivated: user.emailNotificationsActivated,
                        emailNotificationsStatus: user.emailNotificationsStatus,
                        organisation: user.organisation,
                        createdAt: user.life.createdTime,
                        expiredAt: user.expiredAt,
                        description: user.description,
                        metadata: user.metadata
                    };
                }).filter(user => user !== null);
                return decroatedUsers;
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        validateResetPassword: async (_parent, args: { token: string, encryptedEmail: string }) => {
            try {
                return await userCore.validateResetPassword(args.token, args.encryptedEmail);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        recoverSessionExpireTime: async () => {
            try {
                return await userCore.recoverSessionExpireTime();
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        }
    },
    User: {
        access: async (user: IUserWithoutToken) => {
            try {
                return await {
                    id: `user_access_obj_user_id_${user?.id}`,
                    projects: [],
                    studies: await db.collections.studies_collection.find({
                        id: {
                            $in:
                                (await permissionCore.getRolesOfUser(user, user.id)).map(el => el.studyId)
                        }
                    }).toArray()
                };
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        username: async (user: IUserWithoutToken) => {
            return await user.username;
        },
        description: async (user: IUserWithoutToken) => {
            return await user.description;
        },
        email: async (user: IUserWithoutToken) => {
            return await user.email;
        }
    },
    Mutation: {
        requestExpiryDate: async (_parent: Record<string, unknown>, { username, email }: { username?: string, email?: string }) => {
            try {
                return await userCore.requestExpiryDate(username, email);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        requestUsernameOrResetPassword: async (_parent: Record<string, unknown>, { forgotUsername, forgotPassword, email, username }: { forgotUsername: boolean, forgotPassword: boolean, email?: string, username?: string }, context) => {
            try {
                return await userCore.requestUsernameOrResetPassword(forgotUsername, forgotPassword, context.req.headers.origin, email, username);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        login: async (_parent: Record<string, unknown>, args: { username: string, password: string, totp: string, requestexpirydate?: boolean }, context) => {
            try {
                const response = await userCore.login(context.req, args.username, args.password, args.totp, args.requestexpirydate);
                if (response) {
                    return {
                        ...response,
                        createdAt: (response as IUserWithoutToken).life.createdTime
                    };
                } else {
                    return response;
                }
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        logout: async (_parent: Record<string, unknown>, _args: unknown, context) => {
            try {
                return await userCore.logout(context.req.user, context.req);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        createUser: async (_parent, args: { user: V2CreateUserInput }, context) => {
            try {
                const user = await userCore.createUser(
                    context.req.user,
                    args.user.username,
                    args.user.email,
                    args.user.firstname,
                    args.user.lastname,
                    args.user.organisation,
                    enumUserTypes.STANDARD,
                    args.user.emailNotificationsActivated ?? false,
                    args.user.password,
                    undefined,
                    args.user.description
                );
                return makeGenericReponse(user.id, true, undefined, 'User created successfully.');
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        deleteUser: async (_parent, args: { userId: string }, context) => {
            try {
                return await userCore.deleteUser(context.req.user, args.userId);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        resetPassword: async (_parent, { encryptedEmail, token, newPassword }: { encryptedEmail: string, token: string, newPassword: string }) => {
            try {
                return await userCore.resetPassword(encryptedEmail, token, newPassword);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        editUser: async (_parent, args: { user: V2EditUserInput }, context) => {
            try {
                const user = await userCore.editUser(
                    context.req.user,
                    args.user.id,
                    args.user.username,
                    args.user.email,
                    args.user.firstname,
                    args.user.lastname,
                    args.user.organisation,
                    args.user.type,
                    args.user.emailNotificationsActivated,
                    args.user.password,
                    undefined,
                    undefined,
                    args.user.description,
                    args.user.expiredAt
                );
                return {
                    ...user,
                    createdAt: user?.life?.createdTime,
                    deleted: user?.life?.deletedTime,
                    metadata: {}
                };
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        }
    },
    Subscription: {}
};

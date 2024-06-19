import { IUserWithoutToken } from '@itmat-broker/itmat-types';
import { CreateUserInput, EditUserInput, UserCore } from '@itmat-broker/itmat-cores';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { mailer } from '../../emailer/emailer';
import config from '../../utils/configManager';

const userCore = Object.freeze(new UserCore(db, mailer, config));

export const userResolvers: DMPResolversMap = {
    Query: {
        whoAmI: (_parent, _args, context) => {
            return {
                ...context.req.user,
                createdAt: context.req.user?.life.createdTime,
                deleted: context.req.user?.life.deletedTime
            };
        },
        getUsers: async (_parent, args: { userId?: string }) => {
            return await userCore.getUsers(args.userId);
        },
        validateResetPassword: async (_parent, args: { token: string, encryptedEmail: string }) => {
            return await userCore.validateResetPassword(args.token, args.encryptedEmail);
        },
        recoverSessionExpireTime: async () => {
            return await userCore.recoverSessionExpireTime();
        }
    },
    User: {
        access: async (user: IUserWithoutToken, _args, context) => {
            return await userCore.getUserAccess(context.req.user, user);
        },
        username: async (user: IUserWithoutToken, _args, context) => {
            return await userCore.getUserUsername(context.req.user, user);
        },
        description: async (user: IUserWithoutToken, _args, context) => {
            return await userCore.getUserDescription(context.req.user, user);
        },
        email: async (user: IUserWithoutToken, _args, context) => {
            return await userCore.getUserEmail(context.req.user, user);
        }
    },
    Mutation: {
        requestExpiryDate: async (_parent: Record<string, unknown>, { username, email }: { username?: string, email?: string }) => {
            return await userCore.requestExpiryDate(username, email);
        },
        requestUsernameOrResetPassword: async (_parent: Record<string, unknown>, { forgotUsername, forgotPassword, email, username }: { forgotUsername: boolean, forgotPassword: boolean, email?: string, username?: string }, context) => {
            return await userCore.requestUsernameOrResetPassword(forgotUsername, forgotPassword, context.req.headers.origin, email, username);
        },
        login: async (_parent: Record<string, unknown>, args: { username: string, password: string, totp: string, requestexpirydate?: boolean }, context) => {
            return await userCore.login(context.req, args.username, args.password, args.totp, args.requestexpirydate);
        },
        logout: async (_parent: Record<string, unknown>, _args: unknown, context) => {
            return await userCore.logout(context.req);
        },
        createUser: async (_parent, args: { user: CreateUserInput }) => {
            return await userCore.createUser(args.user);
        },
        deleteUser: async (_parent, args: { userId: string }, context) => {
            return await userCore.deleteUser(context.req.user, args.userId);
        },
        resetPassword: async (_parent, { encryptedEmail, token, newPassword }: { encryptedEmail: string, token: string, newPassword: string }) => {
            return await userCore.resetPassword(encryptedEmail, token, newPassword);
        },
        editUser: async (_parent, args: { user: EditUserInput }, context) => {
            return await userCore.editUser(context.req.user, args.user);
        }
    },
    Subscription: {}
};

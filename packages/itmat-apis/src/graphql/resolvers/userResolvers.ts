import { CoreError, IUserWithoutToken, enumUserTypes } from '@itmat-broker/itmat-types';
import { DBType, GraphQLErrorDecroator, PermissionCore, UserCore, V2CreateUserInput, V2EditUserInput, errorCodes, makeGenericResponse } from '@itmat-broker/itmat-cores';
import { DMPResolversMap } from './context';
import { GraphQLError } from 'graphql';


export class UserResolvers {
    db: DBType;
    userCore: UserCore;
    permissionCore: PermissionCore;
    constructor(db: DBType, userCore: UserCore, permissionCore: PermissionCore) {
        this.db = db;
        this.userCore = userCore;
        this.permissionCore = permissionCore;
    }

    whoAmI(_parent, _args, context) {
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
        } catch {
            return null;
        }
    }

    async getUsers(_parent, args: { userId?: string }, context) {
        try {
            const users = args.userId ? [await this.userCore.getUser(context.req.user, args.userId)] : await this.userCore.getUsers(context.req.user);
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
    }

    async validateResetPassword(_parent, args: { token: string, encryptedEmail: string }) {
        try {
            return await this.userCore.validateResetPassword(args.token, args.encryptedEmail);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async recoverSessionExpireTime() {
        try {
            return await this.userCore.recoverSessionExpireTime();
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async userAccess(user: IUserWithoutToken) {
        try {
            return await {
                id: `user_access_obj_user_id_${user?.id}`,
                projects: [],
                studies: await this.db.collections.studies_collection.find({
                    id: {
                        $in:
                            (await this.permissionCore.getRolesOfUser(user, user.id)).map(el => el.studyId)
                    }
                }).toArray()
            };
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async userUsername(user: IUserWithoutToken) {
        return await user.username;
    }

    async userDescription(user: IUserWithoutToken) {
        return await user.description;
    }

    async userEmail(user: IUserWithoutToken) {
        return await user.email;
    }

    async requestExpiryDate(_parent: Record<string, unknown>, { username, email }: { username?: string, email?: string }) {
        try {
            return await this.userCore.requestExpiryDate(username, email);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async requestUsernameOrResetPassword(_parent: Record<string, unknown>, { forgotUsername, forgotPassword, email, username }: { forgotUsername: boolean, forgotPassword: boolean, email?: string, username?: string }, context) {
        try {
            return await this.userCore.requestUsernameOrResetPassword(forgotUsername, forgotPassword, context.req.headers.origin, email, username);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async login(_parent: Record<string, unknown>, args: { username: string, password: string, totp: string, requestexpirydate?: boolean }, context) {
        try {
            const response = await this.userCore.login(context.req, args.username, args.password, args.totp, args.requestexpirydate);
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
    }

    async logout(_parent: Record<string, unknown>, _args: unknown, context) {
        try {
            return await this.userCore.logout(context.req.user, context.req);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async createUser(_parent, args: { user: V2CreateUserInput }, context) {
        try {
            const user = await this.userCore.createUser(
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
            return makeGenericResponse(user.id, true, undefined, 'User created successfully.');
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async deleteUser(_parent, args: { userId: string }, context) {
        try {
            return await this.userCore.deleteUser(context.req.user, args.userId);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async resetPassword(_parent, { encryptedEmail, token, newPassword }: { encryptedEmail: string, token: string, newPassword: string }) {
        try {
            return await this.userCore.resetPassword(encryptedEmail, token, newPassword);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async editUser(_parent, args: { user: V2EditUserInput }, context) {
        try {
            const user = await this.userCore.editUser(
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

    getResolvers(): DMPResolversMap {
        return {
            Query: {
                whoAmI: this.whoAmI.bind(this),
                getUsers: this.getUsers.bind(this),
                validateResetPassword: this.validateResetPassword.bind(this),
                recoverSessionExpireTime: this.recoverSessionExpireTime.bind(this)
            },
            User: {
                access: this.userAccess.bind(this),
                username: this.userUsername.bind(this),
                description: this.userDescription.bind(this),
                email: this.userEmail.bind(this)
            },
            Mutation: {
                requestExpiryDate: this.requestExpiryDate.bind(this),
                requestUsernameOrResetPassword: this.requestUsernameOrResetPassword.bind(this),
                login: this.login.bind(this),
                logout: this.logout.bind(this),
                createUser: this.createUser.bind(this),
                deleteUser: this.deleteUser.bind(this),
                resetPassword: this.resetPassword.bind(this),
                editUser: this.editUser.bind(this)
            }
        };
    }
}

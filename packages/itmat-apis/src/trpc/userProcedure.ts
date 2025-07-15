import { UserCore } from '@itmat-broker/itmat-cores';
import { z } from 'zod';
import { FileUploadSchema, enumUserTypes } from '@itmat-broker/itmat-types';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';


export class UserRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    userCore: UserCore;
    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, userCore: UserCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.userCore = userCore;
    }

    _router() {
        return this.router({
            /**
             * Return the object of IUser of the current requester.
             *
             * @return Record<string, unknown> - The object of IUser.
             */
            whoAmI: this.baseProcedure.query(async (opts) => {
                return opts.ctx.req.user ?? null;
            }),
            /**
             * Get a user.
             *
             * @param userId - The id of the user. If null, return all users.
             * @return IUserWithoutToken
             */
            getUser: this.baseProcedure.input(z.object({
                userId: z.optional(z.string()),
                username: z.optional(z.string()),
                email: z.optional(z.string())
            })).query(async (opts) => {
                return await this.userCore.getUser(opts.ctx.user, opts.input.userId, opts.input.username, opts.input.email);
            }),
            /**
             * Get all users.
             *
             * @param includedDeleted - If true, return all users including deleted ones.
             * @return IUserWithoutToken
             */
            getUsers: this.baseProcedure.input(z.object({
                includedDeleted: z.optional(z.boolean())
            })).query(async (opts) => {
                return await this.userCore.getUsers(opts.ctx.user, opts.input.includedDeleted);
            }),
            /**
             * Refresh the existing session to avoid timeout. Express will update the session as long as there is a new query in.
             *
             * @return IGenericResponse - The obejct of IGenericResponse.
             */
            recoverSessionExpireTime: this.baseProcedure.query(() => {
                return null;
            }),
            /**
             * Validate the token from the reset password request.
             *
             * @param encryptedEmail - The encrypted email.
             * @param token - The token for resetting password.
             * @returns IGenericResponse
             */
            validateResetPassword: this.baseProcedure.input(z.object({
                encryptedEmail: z.string(),
                token: z.string()
            })).query(async (opts) => {
                return await this.userCore.validateResetPassword(opts.input.encryptedEmail, opts.input.token);
            }),
            /**
             * Ask for a request to extend account expiration time. Send notifications to user and admin.
             *
             * @param email - The email of the user.
             *
             * @return IGenericResponse - The object of IGenericResponse
             */
            requestExpiryDate: this.baseProcedure.input(z.object({
                username: z.optional(z.string()),
                email: z.optional(z.string())
            })).mutation(async (opts) => {
                return await this.userCore.requestExpiryDate(opts.input.username, opts.input.email);
            }),
            /**
             * Request for resetting password.
             *
             * @param forgotUsername - Whether user forget the username.
             * @param forgotPassword - Whether user forgot the password.
             * @param email - The email of the user. If using email to reset password.
             * @param username - The username of the uer. If using username to reset password.
             *
             * @return IGenericResponse - The object of IGenericResponse.
             */
            requestUsernameOrResetPassword: this.baseProcedure.input(z.object({
                forgotUsername: z.boolean(),
                forgotPassword: z.boolean(),
                email: z.optional(z.string()),
                username: z.optional(z.string())
            })).mutation(async (opts) => {
                return await this.userCore.requestUsernameOrResetPassword(opts.input.forgotUsername, opts.input.forgotPassword, opts.ctx.req.headers.origin, opts.input.email, opts.input.username);
            }),
            /**
             * Log in to the system.
             *
             * @param username - The username of the user.
             * @param password - The password of the user.
             * @param totp - The totp of the user.
             * @param requestexpirydate - Whether to request for extend the expiration time of the user.
             *
             * @return Partial<IUser> - The object of Partial<IUser>
             */
            login: this.baseProcedure.input(z.object({
                username: z.string(),
                password: z.string(),
                totp: z.string(),
                requestexpirydate: z.optional(z.boolean())
            })).mutation(async (opts) => {
                return await this.userCore.login(opts.ctx.req, opts.input.username, opts.input.password, opts.input.totp, opts.input.requestexpirydate);
            }),
            /**
             * Logout an account.
             *
             * @return IGenericResponse - The object of IGenericResponse.
             */
            logout: this.baseProcedure.mutation(async (opts) => {
                return await this.userCore.logout(opts.ctx.user, opts.ctx.req);
            }),
            /**
             * Create a user.
             *
             * @param username - The username of the user.
             * @param firstname - The firstname of the user.
             * @param lastname - The lastname of the user.
             * @param email - The email of the user.
             * @param password - The password of the user.
             * @param description - The description of the user.
             * @param organisation - The organisation of the user.
             * @param profile - The profile of the user.
             *
             * @return IUser
             */
            createUser: this.baseProcedure.input(z.object({
                username: z.string(),
                firstname: z.string(),
                lastname: z.string(),
                email: z.string(),
                password: z.string(),
                description: z.optional(z.string()),
                organisation: z.string(),
                files: z.optional(z.object({
                    profile: z.optional(z.array(FileUploadSchema))
                }))
            })).mutation(async (opts) => {
                return await this.userCore.createUser(
                    opts.ctx.user,
                    opts.input.username,
                    opts.input.email,
                    opts.input.firstname,
                    opts.input.lastname,
                    opts.input.organisation,
                    enumUserTypes.GUEST,
                    false,
                    opts.input.password,
                    opts.input.files?.profile?.[0]
                );
            }),
            /**
             * Delete a user.
             *
             * @param userId - The id of the user.
             *
             * @return IGenericResponse - The object of IGenericResponse.
             */
            deleteUser: this.baseProcedure.input(z.object({
                userId: z.string()
            })).mutation(async (opts) => {
                return await this.userCore.deleteUser(opts.ctx.user, opts.input.userId);
            }),
            /**
             * Reset the password of an account.
             *
             * @param encryptedEmail - The encrypted email of the user.
             * @param token - The id of the reset password request of the user.
             * @param newPassword - The new password.
             *
             * @return IGenericResponse - The object of IGenericResponse.
             */
            resetPassword: this.baseProcedure.input(z.object({
                encryptedEmail: z.string(),
                token: z.string(),
                newPassword: z.string()
            })).mutation(async (opts) => {
                return await this.userCore.resetPassword(opts.input.encryptedEmail, opts.input.token, opts.input.newPassword);
            }),
            /**
             * Edit a user. Besides description, other fields whose values is null will not be updated.
             *
             * @param userId - The id of the user.
             * @param username - The username of the user.
             * @param type - The type of the user.
             * @param firstname - The first name of the user.
             * @param lastname - The last name of the user.
             * @param email - The email of the user.
             * @param emailNotificationsActivated - Whether the email notification is activated.
             * @param password - The password of the user.
             * @param description - The description of the user.
             * @param organisaiton - The organisation of the user.
             * @param expiredAt - The expiration time of the user.
             * @param profile - The profile of the user.
             *
             * @return Partial<IUser> - The object of IUser.
             */
            editUser: this.baseProcedure.input(z.object({
                userId: z.string(),
                username: z.optional(z.string()),
                type: z.optional(z.nativeEnum(enumUserTypes)),
                firstname: z.optional(z.string()),
                lastname: z.optional(z.string()),
                email: z.optional(z.string()),
                password: z.optional(z.string()),
                description: z.optional(z.string()),
                organisation: z.optional(z.string()),
                emailNotificationsActivated: z.optional(z.boolean()),
                otpSecret: z.optional(z.string()),
                expiredAt: z.optional(z.number()),
                files: z.optional(z.object({
                    profile: z.optional(z.array(FileUploadSchema))
                }))
            })).mutation(async (opts) => {
                return await this.userCore.editUser(
                    opts.ctx.user,
                    opts.input.userId,
                    opts.input.username,
                    opts.input.email,
                    opts.input.firstname,
                    opts.input.lastname,
                    opts.input.organisation,
                    opts.input.type,
                    opts.input.emailNotificationsActivated,
                    opts.input.password,
                    opts.input.otpSecret,
                    opts.input.files?.profile?.[0],
                    opts.input.description,
                    opts.input.expiredAt

                );
            }),
            /**
             * Get keys of a user.
             *
             * @param userId - The id of the user.
             * @return IPubkeys[]
             */
            getUserKeys: this.baseProcedure.input(z.object({
                userId: z.string()
            })).query(async (opts) => {
                return await this.userCore.getUserKeys(opts.ctx.user, opts.input.userId);
            }),
            /**
             * Register a public key.
             *
             * @param pubkey - The public key.
             * @param signature - The signature of the public key.
             * @param associatedUserId - The id of the user.
             * @return IPubkey
             */
            registerPubkey: this.baseProcedure.input(z.object({
                pubkey: z.string(),
                hashedPrivateKey: z.string(),
                associatedUserId: z.string()
            })).mutation(async (opts) => {
                return await this.userCore.registerPubkey(opts.ctx.user, opts.input.pubkey, opts.input.hashedPrivateKey, opts.input.associatedUserId);
            }),
            /**
             * Request an access token.
             * @param username - The username of the user.
             * @param pubkey - The public key.
             *
             * @return challenge
             */
            requestAccessToken: this.baseProcedure.input(z.object({
                username: z.string(),
                hashedPrivateKey: z.string()
            })).mutation(async (opts) => {
                return await this.userCore.requestAccessToken(opts.input.username, opts.input.hashedPrivateKey);
            }),
            /**
             * Get an access token.
             * @param username - The username of the user.
             * @param pubkey - The public key.
             *
             * @return token
             */
            getAccessToken: this.baseProcedure.input(z.object({
                username: z.string(),
                hashedPrivateKey: z.string(),
                signature: z.string()
            })).mutation(async (opts) => {
                return await this.userCore.getAccessToken(opts.input.username, opts.input.hashedPrivateKey, opts.input.signature);
            }),
            /**
                 * Issue an access token.
                 *
                 * @param pubkey - The public key.
                 * @param signature - The signature of the public key.
                 * @param life - The life of the token.
                 * @return IAccessToken
                 */
            issueAccessToken: this.baseProcedure.input(z.object({
                pubkey: z.string(),
                signature: z.string(),
                life: z.optional(z.number())
            })).mutation(async (opts) => {
                return await this.userCore.issueAccessToken(opts.input.pubkey, opts.input.signature, opts.input.life);
            }),
            /**
                 * Delete a public key.
                 *
                 * @param keyId - The id of the public key.
                 * @param associatedUserId - The id of the user.
                 */
            deletePubkey: this.baseProcedure.input(z.object({
                associatedUserId: z.string(),
                keyId: z.string()
            })).mutation(async (opts) => {
                return await this.userCore.deletePubkey(opts.ctx.user, opts.input.associatedUserId, opts.input.keyId);
            })
        });
    }
}

import { ApolloError, UserInputError } from 'apollo-server-express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { mailer } from '../../emailer/emailer';
import {
    Models,
    Logger,
    IProject,
    IStudy,
    IUser,
    IUserWithoutToken,
    IResetPasswordRequest,
    userTypes,
    IOrganisation
} from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import mongodb from 'mongodb';
import { db } from '../../database/database';
import config from '../../utils/configManager';
import { userCore } from '../core/userCore';
import { errorCodes } from '../errors';
import { makeGenericReponse, IGenericResponse } from '../responses';
import * as mfa from '../../utils/mfa';
import QRCode from 'qrcode';
import tmp from 'tmp';

export const userResolvers = {
    Query: {
        whoAmI(parent: Record<string, unknown>, __unused__args: any, context: any): Record<string, unknown> {
            return context.req.user;
        },
        getUsers: async (__unused__parent: Record<string, unknown>, args: any): Promise<IUser[]> => {
            // everyone is allowed to see all the users in the app. But only admin can access certain fields, like emails, etc - see resolvers for User type.
            const queryObj = args.userId === undefined ? { deleted: null } : { deleted: null, id: args.userId };
            const cursor = db.collections!.users_collection.find<IUser>(queryObj, { projection: { _id: 0 } });
            return cursor.toArray();
        },
        validateResetPassword: async (__unused__parent: Record<string, unknown>, args: any): Promise<IGenericResponse> => {
            /* decrypt email */
            const salt = makeAESKeySalt(args.token);
            const iv = makeAESIv(args.token);
            let email;
            try {
                email = await decryptEmail(args.encryptedEmail, salt, iv);
            } catch (e) {
                throw new ApolloError('Token is not valid.');
            }

            /* check whether username and token is valid */
            /* not changing password too in one step (using findOneAndUpdate) because bcrypt is costly */
            const TIME_NOW = new Date().valueOf();
            const ONE_HOUR_IN_MILLISEC = 60 * 60 * 1000;
            const user: IUserWithoutToken | null = await db.collections!.users_collection.findOne({
                email,
                resetPasswordRequests: {
                    $elemMatch: {
                        id: args.token,
                        timeOfRequest: { $gt: TIME_NOW - ONE_HOUR_IN_MILLISEC },
                        used: false
                    }
                },
                deleted: null
            });
            if (!user) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            return makeGenericReponse();
        },
        recoverSessionExpireTime: async (__unused__parent: Record<string, unknown>, __unused__context: any): Promise<IGenericResponse> => {
            return makeGenericReponse();
        }
    },
    User: {
        access: async (user: IUser, __unused__arg: any, context: any): Promise<{ projects: IProject[], studies: IStudy[], id: string }> => {
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
            const roles = await db.collections!.roles_collection.find({ users: user.id, deleted: null }).toArray();
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

            const projects = await db.collections!.projects_collection.find({
                $or: [
                    { id: { $in: studiesAndProjectThatUserCanSee.projects }, deleted: null },
                    { studyId: { $in: studiesAndProjectThatUserCanSee.studies }, deleted: null }
                ]
            }).toArray();
            const studies = await db.collections!.studies_collection.find({ id: { $in: studiesAndProjectThatUserCanSee.studies }, deleted: null }).toArray();
            return { id: `user_access_obj_user_id_${user.id}`, projects, studies };
        },
        username: async (user: IUser, __unused__arg: any, context: any): Promise<string | null> => {
            const requester: Models.UserModels.IUser = context.req.user;
            /* only admin can access this field */
            if (context.req.user.type !== userTypes.ADMIN && user.id !== requester.id) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            return user.username;
        },
        description: async (user: IUser, __unused__arg: any, context: any): Promise<string | null> => {
            const requester: Models.UserModels.IUser = context.req.user;
            /* only admin can access this field */
            if (context.req.user.type !== userTypes.ADMIN && user.id !== requester.id) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            return user.description;
        },
        email: async (user: IUser, __unused__arg: any, context: any): Promise<string | null> => {
            const requester: Models.UserModels.IUser = context.req.user;
            /* only admin can access this field */
            if (context.req.user.type !== userTypes.ADMIN && user.id !== requester.id) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            return user.email;
        }
    },
    Mutation: {
        requestExpiryDate: async (__unused__parent: Record<string, unknown>, { username, email }: { username?: string, email?: string }): Promise<IGenericResponse> => {
            /* double-check user existence */
            const queryObj = email ? { deleted: null, email } : { deleted: null, username };
            const user: IUser | null = await db.collections!.users_collection.findOne(queryObj);
            if (!user) {
                /* even user is null. send successful response: they should know that a user doesn't exist */
                await new Promise(resolve => setTimeout(resolve, Math.random() * 6000));
                return makeGenericReponse();
            }
            /* send email to the DMP admin mailing-list */
            await mailer.sendMail(formatEmailRequestExpiryDatetoAdmin({
                userEmail: user.email,
                username: user.username
            }));

            /* send email to client */
            await mailer.sendMail(formatEmailRequestExpiryDatetoClient({
                to: user.email,
                username: user.username
            }));

            return makeGenericReponse();
        },
        requestUsernameOrResetPassword: async (__unused__parent: Record<string, unknown>, { forgotUsername, forgotPassword, email, username }: { forgotUsername: boolean, forgotPassword: boolean, email?: string, username?: string }, context: any): Promise<IGenericResponse> => {
            /* checking the args are right */
            if ((forgotUsername && !email) // should provide email if no username
                || (forgotUsername && username) // should not provide username if it's forgotten..
                || (!email && !username)) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            } else if (email && username) {
                // TO_DO : better client erro
                /* only provide email if no username */
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }

            /* check user existence */
            const queryObj = email ? { deleted: null, email } : { deleted: null, username };
            const user = await db.collections!.users_collection.findOne(queryObj);
            if (!user) {
                /* even user is null. send successful response: they should know that a user doesn't exist */
                await new Promise(resolve => setTimeout(resolve, Math.random() * 6000));
                return makeGenericReponse();
            }

            if (forgotPassword) {
                /* make link to change password */
                const passwordResetToken = uuid();
                const resetPasswordRequest: IResetPasswordRequest = {
                    id: passwordResetToken,
                    timeOfRequest: new Date().valueOf(),
                    used: false
                };
                const invalidateAllTokens = await db.collections!.users_collection.findOneAndUpdate(
                    queryObj,
                    {
                        $set: {
                            'resetPasswordRequests.$[].used': true
                        }
                    }
                );
                if (invalidateAllTokens.ok !== 1) {
                    throw new ApolloError(errorCodes.DATABASE_ERROR);
                }
                const updateResult = await db.collections!.users_collection.findOneAndUpdate(
                    queryObj,
                    {
                        $push: {
                            resetPasswordRequests: resetPasswordRequest
                        }
                    }
                );
                if (updateResult.ok !== 1) {
                    throw new ApolloError(errorCodes.DATABASE_ERROR);
                }

                /* send email to client */
                await mailer.sendMail(await formatEmailForForgottenPassword({
                    to: user.email,
                    resetPasswordToken: passwordResetToken,
                    username: user.username,
                    firstname: user.firstname,
                    origin: context.req.headers.origin
                }));
            } else {
                /* send email to client */
                await mailer.sendMail(formatEmailForFogettenUsername({
                    to: user.email,
                    username: user.username
                }));
            }
            return makeGenericReponse();
        },
        login: async (parent: Record<string, unknown>, args: any, context: any): Promise<Record<string, unknown>> => {
            const { req }: { req: Express.Request } = context;
            const result = await db.collections!.users_collection.findOne({ deleted: null, username: args.username });
            if (!result) {
                throw new UserInputError('User does not exist.');
            }

            const passwordMatched = await bcrypt.compare(args.password, result.password);
            if (!passwordMatched) {
                throw new UserInputError('Incorrect password.');
            }

            // validate the TOTP
            const totpValidated = mfa.verifyTOTP(args.totp, result.otpSecret);
            if (!totpValidated && process.env.NODE_ENV !== 'development') {
                throw new UserInputError('Incorrect One-Time password.');
            }

            /* validate if account expired */
            if (result.expiredAt < Date.now() && result.type === userTypes.STANDARD) {
                if (args.requestexpirydate) {
                    /* send email to the DMP admin mailing-list */
                    await mailer.sendMail(formatEmailRequestExpiryDatetoAdmin({
                        userEmail: result.email,
                        username: result.username
                    }));
                    /* send email to client */
                    await mailer.sendMail(formatEmailRequestExpiryDatetoClient({
                        to: result.email,
                        username: result.username
                    }));
                    throw new UserInputError('New expiry date has been requested! Wait for ADMIN to approve.');
                }

                throw new UserInputError('Account Expired. Please request a new expiry date!');
            }

            const filteredResult: Partial<IUser> = { ...result };
            delete filteredResult.password;
            delete filteredResult.deleted;

            return new Promise((resolve) => {
                req.login(filteredResult, (err: any) => {
                    if (err) {
                        Logger.error(err);
                        throw new ApolloError('Cannot log in. Please try again later.');
                    }
                    resolve(filteredResult);
                });
            });
        },
        logout: async (parent: Record<string, unknown>, __unused__args: any, context: any): Promise<IGenericResponse> => {
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
        createUser: async (__unused__parent: Record<string, unknown>, args: any): Promise<IGenericResponse> => {
            const { username, firstname, lastname, email, emailNotificationsActivated, password, description, organisation }: {
                username: string, firstname: string, lastname: string, email: string, emailNotificationsActivated?: boolean, password: string, description?: string, organisation: string
            } = args.user;

            /* check email is valid form */
            if (!/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/.test(email)) {
                throw new UserInputError('Email is not the right format.');
            }

            /* check password validity */
            if (password && !passwordIsGoodEnough(password)) {
                throw new UserInputError('Password has to be at least 8 character long.');
            }

            /* check that username and password dont have space */
            if (username.indexOf(' ') !== -1 || password.indexOf(' ') !== -1) {
                throw new UserInputError('Username or password cannot have spaces.');
            }

            const alreadyExist = await db.collections!.users_collection.findOne({ username, deleted: null }); // since bycrypt is CPU expensive let's check the username is not taken first
            if (alreadyExist !== null && alreadyExist !== undefined) {
                throw new UserInputError('User already exists.');
            }

            /* check if email has been used to register */
            const emailExist = await db.collections!.users_collection.findOne({ email, deleted: null });
            if (emailExist !== null && emailExist !== undefined) {
                throw new UserInputError('This email has been registered. Please sign-in or register with another email!');
            }

            /* randomly generate a secret for Time-based One Time Password*/
            const otpSecret = mfa.generateSecret();

            await userCore.createUser({
                password,
                otpSecret,
                username,
                type: userTypes.STANDARD,
                description: description ?? '',
                firstname,
                lastname,
                email,
                organisation,
                emailNotificationsActivated: !!emailNotificationsActivated
            });

            /* send email to the registered user */
            // get QR Code for the otpSecret.
            const oauth_uri = `otpauth://totp/${config.appName}:${username}?secret=${otpSecret}&issuer=Data%20Science%20Institute`;
            const tmpobj = tmp.fileSync({ mode: 0o644, prefix: 'qrcodeimg-', postfix: '.png' });

            QRCode.toFile(tmpobj.name, oauth_uri, {}, function (err) {
                if (err) throw new ApolloError(err);
            });

            const attachments = [{ filename: 'qrcode.png', path: tmpobj.name, cid: 'qrcode_cid' }];
            await mailer.sendMail({
                from: `${config.appName} <${config.nodemailer.auth.user}>`,
                to: email,
                subject: `[${config.appName}] Registration Successful`,
                html: `
                    <p>
                        Dear ${firstname},
                    <p>
                    <p>
                        Welcome to the ${config.appName} data portal!<br/>
                        Your username is <b>${username}</b>.<br/>
                    </p>
                    <p>
                        To login you will need to use a MFA authenticator app for one time passcode (TOTP).<br/>
                        Scan the QRCode below in your MFA application of choice to configure it:<br/>
                        <img src="cid:qrcode_cid" alt="QR code" width="150" height="150" /><br/>
                        If you need to type the token in use <b>${otpSecret.toLowerCase()}</b>
                    </p>
                    <br/>
                    <p>
                        The ${config.appName} Team.
                    </p>
                `,
                attachments: attachments
            });
            tmpobj.removeCallback();
            return makeGenericReponse();
        },
        deleteUser: async (__unused__parent: Record<string, unknown>, args: any, context: any): Promise<IGenericResponse> => {
            /* only admin can delete users */
            const requester: Models.UserModels.IUser = context.req.user;

            // user (admin type) cannot delete itself
            if (requester.id === args.userId) {
                throw new ApolloError('User cannot delete itself');
            }

            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            await userCore.deleteUser(args.userId);
            return makeGenericReponse(args.userId);
        },
        resetPassword: async (__unused__parent: Record<string, unknown>, { encryptedEmail, token, newPassword }: { encryptedEmail: string, token: string, newPassword: string }): Promise<IGenericResponse> => {
            /* check password validity */
            if (!passwordIsGoodEnough(newPassword)) {
                throw new ApolloError('Password has to be at least 8 character long.');
            }

            /* check that username and password dont have space */
            if (newPassword.indexOf(' ') !== -1) {
                throw new ApolloError('Password cannot have spaces.');
            }

            /* decrypt email */
            if (token.length < 16) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }
            const salt = makeAESKeySalt(token);
            const iv = makeAESIv(token);
            let email;
            try {
                email = await decryptEmail(encryptedEmail, salt, iv);
            } catch (e) {
                throw new ApolloError('Token is not valid.');
            }

            /* check whether username and token is valid */
            /* not changing password too in one step (using findOneAndUpdate) because bcrypt is costly */
            const TIME_NOW = new Date().valueOf();
            const ONE_HOUR_IN_MILLISEC = 60 * 60 * 1000;
            const user: IUserWithoutToken | null = await db.collections!.users_collection.findOne({
                email,
                resetPasswordRequests: {
                    $elemMatch: {
                        id: token,
                        timeOfRequest: { $gt: TIME_NOW - ONE_HOUR_IN_MILLISEC },
                        used: false
                    }
                },
                deleted: null
            });
            if (!user) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* randomly generate a secret for Time-based One Time Password*/
            const otpSecret = mfa.generateSecret();

            /* all ok; change the user's password */
            const hashedPw = await bcrypt.hash(newPassword, config.bcrypt.saltround);
            const updateResult = await db.collections!.users_collection.findOneAndUpdate(
                {
                    id: user.id,
                    resetPasswordRequests: {
                        $elemMatch: {
                            id: token,
                            timeOfRequest: { $gt: TIME_NOW - ONE_HOUR_IN_MILLISEC },
                            used: false
                        }
                    }
                },
                { $set: { 'password': hashedPw, 'otpSecret': otpSecret, 'resetPasswordRequests.$.used': true } });
            if (updateResult.ok !== 1) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }

            /* need to log user out of all sessions */
            // TO_DO

            /* send email to the registered user */
            // get QR Code for the otpSecret.
            const oauth_uri = `otpauth://totp/${config.appName}:${user.username}?secret=${otpSecret}&issuer=Data%20Science%20Institute`;
            const tmpobj = tmp.fileSync({ mode: 0o644, prefix: 'qrcodeimg-', postfix: '.png' });

            QRCode.toFile(tmpobj.name, oauth_uri, {}, function (err) {
                if (err) throw new ApolloError(err);
            });

            const attachments = [{ filename: 'qrcode.png', path: tmpobj.name, cid: 'qrcode_cid' }];
            await mailer.sendMail({
                from: `${config.appName} <${config.nodemailer.auth.user}>`,
                to: email,
                subject: `[${config.appName}] Password reset`,
                html: `
                    <p>
                        Dear ${user.firstname},
                    <p>
                    <p>
                        Your password on ${config.appName} is now reset!<br/>
                        You will need to update your MFA application for one-time passcode.<br/>
                    </p>
                    <p>
                        To update your MFA authenticator app you can scan the QRCode below to configure it:<br/>
                        <img src="cid:qrcode_cid" alt="QR code" width="150" height="150" /><br/>
                        If you need to type the token in use <b>${otpSecret.toLowerCase()}</b>
                    </p>
                    <br/>
                    <p>
                        The ${config.appName} Team.
                    </p>
                `,
                attachments: attachments
            });
            tmpobj.removeCallback();
            return makeGenericReponse();
        },
        editUser: async (__unused__parent: Record<string, unknown>, args: any, context: any): Promise<Record<string, unknown>> => {
            const requester: Models.UserModels.IUser = context.req.user;
            const { id, username, type, firstname, lastname, email, emailNotificationsActivated, password, description, organisation, expiredAt }: {
                id: string, username?: string, type?: Models.UserModels.userTypes, firstname?: string, lastname?: string, email?: string, emailNotificationsActivated?: boolean, password?: string, description?: string, organisation?: string, expiredAt?: number
            } = args.user;
            if (password !== undefined && requester.id !== id) { // only the user themself can reset password
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }
            if (password && !passwordIsGoodEnough(password)) {
                throw new ApolloError('Password has to be at least 8 character long.');
            }
            if (requester.type !== Models.UserModels.userTypes.ADMIN && requester.id !== id) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }
            let result;
            if (requester.type === Models.UserModels.userTypes.ADMIN) {
                result = await db.collections!.users_collection.findOne({ id, deleted: null })!;   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
                if (result === null || result === undefined) {
                    throw new ApolloError('User not found');
                }
            }

            const fieldsToUpdate = {
                type,
                firstname,
                lastname,
                username,
                email,
                emailNotificationsActivated,
                password,
                description,
                organisation,
                expiredAt
            };

            /* check email is valid form */
            if (email && !/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/.test(email)) {
                throw new UserInputError('User not updated: Email is not the right format.');
            }

            if (requester.type !== Models.UserModels.userTypes.ADMIN && (
                type || firstname || lastname || username || description || organisation
            )) {
                throw new ApolloError('User not updated: Non-admin users are only authorised to change their password or email.');
            }

            if (password) { fieldsToUpdate.password = await bcrypt.hash(password, config.bcrypt.saltround); }
            for (const each of Object.keys(fieldsToUpdate)) {
                if (fieldsToUpdate[each] === undefined) {
                    delete fieldsToUpdate[each];
                }
            }
            const updateResult: mongodb.ModifyResult<any> = await db.collections!.users_collection.findOneAndUpdate({ id, deleted: null }, { $set: fieldsToUpdate }, { returnDocument: 'after' });
            if (updateResult.ok === 1) {
                // New expiry date has been updated successfully.
                if (expiredAt) {
                    /* send email to client */
                    await mailer.sendMail(formatEmailRequestExpiryDateNotification({
                        to: result.email,
                        username: result.username
                    }));
                }
                return updateResult.value;
            } else {
                throw new ApolloError('Server error; no entry or more than one entry has been updated.');
            }
        },
        createOrganisation: async (__unused__parent: Record<string, unknown>, { name, shortname, containOrg, metadata }: { name: string, shortname: string, containOrg: string, metadata: any }, context: any): Promise<IOrganisation> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }
            // if the org already exists, update it; the existence is checked by the name
            const createdOrganisation = await userCore.createOrganisation({
                name,
                shortname: shortname ?? null,
                containOrg: containOrg ?? null,
                metadata: metadata ?? null
            });

            return createdOrganisation;
        },
        deleteOrganisation: async (__unused__parent: Record<string, unknown>, { id }: { id: string }, context: any): Promise<IOrganisation> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            const res = await db.collections!.organisations_collection.findOneAndUpdate({ id: id }, {
                $set: {
                    deleted: Date.now()
                }
            }, {
                returnDocument: 'after'
            });

            if (res.ok === 1 && res.value) {
                return res.value;
            } else {
                throw new ApolloError('Delete organisation failed.');
            }
        }
    },
    Subscription: {}
};

export function makeAESKeySalt(str: string): string {
    return str;
}

export function makeAESIv(str: string): string {
    if (str.length < 16) { throw new Error('IV cannot be less than 16 bytes long.'); }
    return str.slice(0, 16);
}

export async function encryptEmail(email: string, keySalt: string, iv: string): Promise<string> {
    const algorithm = 'aes-256-cbc';
    return new Promise((resolve, reject) => {
        crypto.scrypt(config.aesSecret, keySalt, 32, (err, derivedKey) => {
            if (err) reject(err);
            const cipher = crypto.createCipheriv(algorithm, derivedKey, iv);
            let encoded = cipher.update(email, 'utf8', 'hex');
            encoded += cipher.final('hex');
            resolve(encoded);
        });
    });

}

export async function decryptEmail(encryptedEmail: string, keySalt: string, iv: string): Promise<string> {
    const algorithm = 'aes-256-cbc';
    return new Promise((resolve, reject) => {
        crypto.scrypt(config.aesSecret, keySalt, 32, (err, derivedKey) => {
            if (err) reject(err);
            try {
                const decipher = crypto.createDecipheriv(algorithm, derivedKey, iv);
                let decoded = decipher.update(encryptedEmail, 'hex', 'utf8');
                decoded += decipher.final('utf-8');
                resolve(decoded);
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function formatEmailForForgottenPassword({ username, firstname, to, resetPasswordToken, origin }: { resetPasswordToken: string, to: string, username: string, firstname: string, origin: any }) {
    const keySalt = makeAESKeySalt(resetPasswordToken);
    const iv = makeAESIv(resetPasswordToken);
    const encryptedEmail = await encryptEmail(to, keySalt, iv);

    const link = `${origin}/reset/${encryptedEmail}/${resetPasswordToken}`;
    return ({
        from: `${config.appName} <${config.nodemailer.auth.user}>`,
        to,
        subject: `[${config.appName}] password reset`,
        html: `
            <p>
                Dear ${firstname},
            <p>
            <p>
                Your username is <b>${username}</b>.
            </p>
            <p>
                You can reset you password by click the following link (active for 1 hour):<br/>
                <a href=${link}>${link}</a>
            </p>
            <br/>
            <p>
                The ${config.appName} Team.
            </p>
        `
    });
}

function formatEmailForFogettenUsername({ username, to }: { username: string, to: string }) {
    return ({
        from: `${config.appName} <${config.nodemailer.auth.user}>`,
        to,
        subject: `[${config.appName}] password reset`,
        html: `
            <p>
                Dear user,
            <p>
            <p>
                Your username is <b>${username}</b>.
            </p>
            <br/>
            <p>
                The ${config.appName} Team.
            </p>
        `
    });
}

function formatEmailRequestExpiryDatetoClient({ username, to }: { username: string, to: string }) {
    return ({
        from: `${config.appName} <${config.nodemailer.auth.user}>`,
        to,
        subject: `[${config.appName}] New expiry date has been requested!`,
        html: `
            <p>
                Dear user,
            <p>
            <p>
                New expiry date for your <b>${username}</b> account has been requested.
                You will get a notification email once the request is approved.                
            </p>
            <br/>
            <p>
                The ${config.appName} Team.
            </p>
        `
    });
}

function formatEmailRequestExpiryDatetoAdmin({ username, userEmail }: { username: string, userEmail: string }) {
    return ({
        from: `${config.appName} <${config.nodemailer.auth.user}>`,
        to: `${config.adminEmail}`,
        subject: `[${config.appName}] New expiry date has been requested from ${username} account!`,
        html: `
            <p>
                Dear ADMINs,
            <p>
            <p>
                A expiry date request from the <b>${username}</b> account (whose email address is <b>${userEmail}</b>) has been submitted.
                Please approve or deny the request ASAP.
            </p>
            <br/>
            <p>
                The ${config.appName} Team.
            </p>
        `
    });
}

function formatEmailRequestExpiryDateNotification({ username, to }: { username: string, to: string }) {
    return ({
        from: `${config.appName} <${config.nodemailer.auth.user}>`,
        to,
        subject: `[${config.appName}] New expiry date has been updated!`,
        html: `
            <p>
                Dear user,
            <p>
            <p>
                New expiry date for your <b>${username}</b> account has been updated.
                You now can log in as normal.
            </p>
            <br/>
            <p>
                The ${config.appName} Team.
            </p>
        `
    });
}

function passwordIsGoodEnough(pw: string): boolean {
    if (pw.length < 8) {
        return false;
    }
    return true;
}

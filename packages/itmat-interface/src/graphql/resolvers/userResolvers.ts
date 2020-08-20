import { ApolloError, UserInputError } from 'apollo-server-express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { mailer } from '../../emailer/emailer';
import {
    Models,
    Logger,
    IProject,
    IRole,
    IStudy,
    IUser,
    IUserWithoutToken,
    IResetPasswordRequest,
    userTypes
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
            const user: IUser | null = await db.collections!.users_collection.findOne(queryObj);
            if (!user) {
                /* even user is null. send successful response: they should know that a user dosen't exist */
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
                    realname: user.realName,
                    host: context.req.hostname
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
        login: async (parent: Record<string, unknown>, args: any, context: any): Promise<Record<string, unknown>> => {
            const { req }: { req: Express.Request } = context;
            const result = await db.collections!.users_collection.findOne({ deleted: null, username: args.username });
            if (!result) {
                throw new UserInputError('User does not exist.');
            }

            /* validate if account expired */
            if (result.expiredAt < Date.now() && result.type === userTypes.STANDARD) {
                throw new UserInputError('Account Expired.');
            }

            const passwordMatched = await bcrypt.compare(args.password, result.password);
            if (!passwordMatched) {
                throw new UserInputError('Incorrect password.');
            }
            delete result.password;
            delete result.deleted;

            // validate the TOTP
            const totpValidated = mfa.verifyTOTP(args.totp, result.otpSecret);
            if (!totpValidated) {
                throw new UserInputError('Incorrect TOTP. Obtain the TOTP using Google Authenticator app.');
            }

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
            const { username, realName, email, emailNotificationsActivated, password, description, organisation }: {
                username: string, realName: string, email: string, emailNotificationsActivated: boolean, password: string, description: string, organisation: string
            } = args.user;

            /* check email is valid form */
            if (!/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/.test(email)) {
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

            /* if not specified, type of user is always STANDARD*/
            const type = Models.UserModels.userTypes.STANDARD;

            /* randomly generate a secret for Time-based One Time Password*/
            const otpSecret = mfa.generateSecret();

            const createdUser = await userCore.createUser({
                password,
                otpSecret,
                username,
                type,
                description,
                realName,
                email,
                organisation,
                emailNotificationsActivated
            });

            /* send email to the registered user */
            // get QR Code for the otpSecret. Google Authenticator requires oauth_uri format for the QR code
            const oauth_uri = `otpauth://totp/IDEAFAST:${username}?secret=${createdUser.otpSecret}&issuer=IDEAFAST`;
            const tmpobj = tmp.fileSync({ mode: 0o644, prefix: 'qrcodeimg-', postfix: '.png' });

            QRCode.toFile(tmpobj.name, oauth_uri, {}, function (err) {
                if (err) throw new ApolloError(err);
            });

            const attachments = [{ filename: 'qrcode.png', path: tmpobj.name, cid: 'qrcode_cid' }];
            await mailer.sendMail({
                from: config.nodemailer.auth.user,
                to: email,
                subject: 'IDEA-FAST: Registration Successful',
                html: `<p>Dear ${realName},<p>
                    Welcome to the IDEA-FAST project!
                    <br/>
                    <p>Your username is <b>${username}</b>.</p><br/>
                    <p>Your 2FA otpSecret is: ${createdUser.otpSecret.toLowerCase()}</p>
                    <label> 2FA QR Code: </label> <img src="cid:qrcode_cid" alt="QR code for Google Authenticator" width="150" height="150" /> <br /><br />
                    <p>Please use a MFA authenticator app for time-based one time password (TOTP) when logging in.</p>
                    <br/><br/>
                    
                    Yours truly,
                    NAME team.
                `,
                attachments: attachments
            });
            tmpobj.removeCallback();
            return makeGenericReponse();
        },
        deleteUser: async (__unused__parent: Record<string, unknown>, args: any, context: any): Promise<IGenericResponse> => {
            /* only admin can delete users */
            const requester: Models.UserModels.IUser = context.req.user;
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
            const ONE_HOUR_IN_MILLISEC = 60 /* minutes per hr */ * 60 /* sec per min */ * 1000 /* milli per unit */;
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
                { $set: { 'password': hashedPw, 'resetPasswordRequests.$.used': true } });
            if (updateResult.ok !== 1) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }

            /* need to log user out of all sessions */
            // TO_DO

            return makeGenericReponse();
        },
        editUser: async (__unused__parent: Record<string, unknown>, args: any, context: any): Promise<Record<string, unknown>> => {
            const requester: Models.UserModels.IUser = context.req.user;
            const { id, username, type, realName, email, emailNotificationsActivated, password, description, organisation, expiredAt }: {
                id: string, username?: string, type?: Models.UserModels.userTypes, realName?: string, email?: string, emailNotificationsActivated?: boolean, password?: string, description?: string, organisation?: string, expiredAt?: number
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
            if (requester.type === Models.UserModels.userTypes.ADMIN) {
                const result: Models.UserModels.IUserWithoutToken = await db.collections!.users_collection.findOne({ id, deleted: null })!;   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
                if (result === null || result === undefined) {
                    throw new ApolloError('User not found');
                }
            }

            const fieldsToUpdate = {
                type,
                realName,
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

async function formatEmailForForgottenPassword({ realname, to, resetPasswordToken, username, host }: { host: string, username: string, resetPasswordToken: string, to: string, realname: string }) {
    const keySalt = makeAESKeySalt(resetPasswordToken);
    const iv = makeAESIv(resetPasswordToken);
    const encryptedEmail = await encryptEmail(to, keySalt, iv);


    const link = `${config.useSSL ? 'https' : 'http'}://${host}${process.env.NODE_ENV === 'development' ? `:${config.server.port}` : ''}/resetPassword/${encryptedEmail}/${resetPasswordToken}`;
    return ({
        from: '"NAME"',
        to,
        subject: 'Reset your NAME password',
        html: `<p>Dear ${realname},<p>
            <br/>
            <p>Your username is <b>${username}</b>.</p><br/>
            <p>You can reset you password by click the following link (active for 1 hour):</p>
            <p><a href=${link}>${link}</a></p>
            <br/><br/>

            Yours truly,
            NAME team.
        `
    });
}

function formatEmailForFogettenUsername({ username, to, realname }: { username: string, to: string, realname: string }) {
    return ({
        from: '"NAME" <name@name.io>',
        to,
        subject: 'Your NAME username reminder',
        html: `<p>Dear ${realname},<p>
            <br/>
            <p>Your username is <b>${username}</b>.</p><br/>

            Yours truly,
            NAME team.
        `
    });
}

function passwordIsGoodEnough(pw: string): boolean {
    if (pw.length < 8) {
        return false;
    }
    return true;
}

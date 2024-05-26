import bcrypt from 'bcrypt';
import { GraphQLError } from 'graphql';
import { IUser, IUserWithoutToken, enumUserTypes, IPubkey, IProject, IStudy, IResetPasswordRequest, enumReservedUsers } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { errorCodes } from '../utils/errors';
import { MarkOptional } from 'ts-essentials';
import { IGenericResponse, makeGenericReponse } from '../utils/responses';
import crypto from 'crypto';
import * as mfa from '../utils/mfa';
import { ApolloServerErrorCode } from '@apollo/server/errors';
import { Logger, Mailer } from '@itmat-broker/itmat-commons';
import tmp from 'tmp';
import QRCode from 'qrcode';
import { UpdateFilter } from 'mongodb';
import { DBType } from '../database/database';
import { IConfiguration } from '../utils';


export interface CreateUserInput {
    username: string,
    firstname: string,
    lastname: string,
    email: string,
    emailNotificationsActivated?: boolean,
    password: string,
    description?: string,
    organisation: string,
    metadata: Record<string, unknown> & { logPermission: boolean }
}

export interface EditUserInput {
    id: string,
    username?: string,
    type?: enumUserTypes,
    firstname?: string,
    lastname?: string,
    email?: string,
    emailNotificationsActivated?: boolean,
    emailNotificationsStatus?: unknown,
    password?: string,
    description?: string,
    organisation?: string,
    expiredAt?: number,
    metadata?: unknown
}

export class UserCore {
    db: DBType;
    mailer: Mailer;
    config: IConfiguration;
    emailConfig: IEmailConfig;
    constructor(db: DBType, mailer: Mailer, config: IConfiguration) {
        this.db = db;
        this.mailer = mailer;
        this.config = config;
        this.emailConfig = {
            appName: config.appName,
            nodemailer: {
                auth: {
                    user: config.nodemailer.auth.user
                }
            },
            adminEmail: config.adminEmail
        };

    }

    public async getOneUser_throwErrorIfNotExists(username: string): Promise<IUser> {
        const user = await this.db.collections.users_collection.findOne({ 'life.deletedTime': null, username });
        if (user === undefined || user === null) {
            throw new GraphQLError('User does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        return user;
    }

    public async getUsers(userId?: string) {
        // everyone is allowed to see all the users in the app. But only admin can access certain fields, like emails, etc - see resolvers for User type.
        const queryObj = userId === undefined ? { 'life.deletedTime': null } : { 'life.deletedTime': null, 'id': userId };
        const users = await this.db.collections.users_collection.find<IUserWithoutToken>(queryObj, { projection: { _id: 0, password: 0, otpSecret: 0 } }).toArray();
        const modifiedUsers: Record<string, unknown>[] = [];
        for (const user of users) {
            modifiedUsers.push({
                ...user,
                createdAt: user.life.createdTime,
                deleted: user.life.deletedTime
            });
        }
        return modifiedUsers;
    }

    public async validateResetPassword(token: string, encryptedEmail: string) {
        /* decrypt email */
        const salt = makeAESKeySalt(token);
        const iv = makeAESIv(token);
        let email;
        try {
            email = await decryptEmail(this.config.aesSecret, encryptedEmail, salt, iv);
        } catch (e) {
            throw new GraphQLError('Token is not valid.');
        }

        /* check whether username and token is valid */
        /* not changing password too in one step (using findOneAndUpdate) because bcrypt is costly */
        const TIME_NOW = new Date().valueOf();
        const ONE_HOUR_IN_MILLISEC = 60 * 60 * 1000;
        const user: IUserWithoutToken | null = await this.db.collections.users_collection.findOne({
            email,
            'resetPasswordRequests': {
                $elemMatch: {
                    id: token,
                    timeOfRequest: { $gt: TIME_NOW - ONE_HOUR_IN_MILLISEC },
                    used: false
                }
            },
            'life.deletedTime': null
        });
        if (!user) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return makeGenericReponse();
    }

    public async recoverSessionExpireTime() {
        return makeGenericReponse();
    }

    public async getUserAccess(requester: IUserWithoutToken | undefined, user: IUserWithoutToken) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* only admin can access this field */
        if (requester.type !== enumUserTypes.ADMIN && user.id !== requester.id) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        /* if requested user is admin, then he has access to all studies */
        if (user.type === enumUserTypes.ADMIN) {
            const allprojects: IProject[] = await this.db.collections.projects_collection.find({ deleted: null }).toArray();
            const allstudies: IStudy[] = await this.db.collections.studies_collection.find({ 'life.deletedTime': null }).toArray();
            return { id: `user_access_obj_user_id_${user.id}`, projects: allprojects, studies: allstudies };
        }

        /* if requested user is not admin, find all the roles a user has */
        const roles = await this.db.collections.roles_collection.find({ users: user.id, deleted: null }).toArray();
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

        const projects = await this.db.collections.projects_collection.find({
            $or: [
                { id: { $in: studiesAndProjectThatUserCanSee.projects }, deleted: null },
                { studyId: { $in: studiesAndProjectThatUserCanSee.studies }, deleted: null }
            ]
        }).toArray();
        const studies = await this.db.collections.studies_collection.find({ 'id': { $in: studiesAndProjectThatUserCanSee.studies }, 'life.deletedTime': null }).toArray();
        return { id: `user_access_obj_user_id_${user.id}`, projects, studies };
    }

    public async getUserUsername(requester: IUserWithoutToken | undefined, user: IUserWithoutToken) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* only admin can access this field */
        if (requester.type !== enumUserTypes.ADMIN && user.id !== requester.id) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        return user.username;
    }

    public getUserDescription(requester: IUserWithoutToken | undefined, user: IUserWithoutToken) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* only admin can access this field */
        if (requester.type !== enumUserTypes.ADMIN && user.id !== requester.id) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        return user.description;
    }

    public async getUserEmail(requester: IUserWithoutToken | undefined, user: IUserWithoutToken) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* only admin can access this field */
        if (requester.type !== enumUserTypes.ADMIN && user.id !== requester.id) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        return user.email;
    }

    public async requestExpiryDate(username?: string, email?: string) {
        /* double-check user existence */
        const queryObj = email ? { 'life.deletedTime': null, email } : { 'life.deletedTime': null, username };
        const user: IUser | null = await this.db.collections.users_collection.findOne(queryObj);
        if (!user) {
            /* even user is null. send successful response: they should know that a user doesn't exist */
            await new Promise(resolve => setTimeout(resolve, Math.random() * 6000));
            return makeGenericReponse();
        }
        /* send email to the DMP admin mailing-list */
        await this.mailer.sendMail(formatEmailRequestExpiryDatetoAdmin({
            config: this.emailConfig,
            userEmail: user.email,
            username: user.username
        }));

        /* send email to client */
        await this.mailer.sendMail(formatEmailRequestExpiryDatetoClient({
            config: this.emailConfig,
            to: user.email,
            username: user.username
        }));

        return makeGenericReponse();
    }

    public async requestUsernameOrResetPassword(forgotUsername: boolean, forgotPassword: boolean, origin: string, email?: string, username?: string) {
        /* checking the args are right */
        if ((forgotUsername && !email) // should provide email if no username
            || (forgotUsername && username) // should not provide username if it's forgotten..
            || (!email && !username)) {
            throw new GraphQLError(errorCodes.CLIENT_MALFORMED_INPUT);
        } else if (email && username) {
            // TO_DO : better client erro
            /* only provide email if no username */
            throw new GraphQLError(errorCodes.CLIENT_MALFORMED_INPUT);
        }

        /* check user existence */
        const queryObj = email ? { 'life.deletedTime': null, email } : { 'life.deletedTime': null, username };
        const user = await this.db.collections.users_collection.findOne(queryObj);
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
            const invalidateAllTokens = await this.db.collections.users_collection.findOneAndUpdate(
                queryObj,
                {
                    $set: {
                        'resetPasswordRequests.$[].used': true
                    }
                }
            );
            if (invalidateAllTokens === null) {
                throw new GraphQLError(errorCodes.DATABASE_ERROR);
            }
            const updateResult = await this.db.collections.users_collection.findOneAndUpdate(
                queryObj,
                {
                    $push: {
                        resetPasswordRequests: resetPasswordRequest
                    }
                }
            );
            if (updateResult === null) {
                throw new GraphQLError(errorCodes.DATABASE_ERROR);
            }

            /* send email to client */
            await this.mailer.sendMail(await formatEmailForForgottenPassword({
                config: this.emailConfig,
                aesSecret: this.config.aesSecret,
                to: user.email,
                resetPasswordToken: passwordResetToken,
                username: user.username,
                firstname: user.firstname,
                origin: origin
            }));
        } else {
            /* send email to client */
            await this.mailer.sendMail(formatEmailForFogettenUsername({
                config: this.emailConfig,
                to: user.email,
                username: user.username
            }));
        }
        return makeGenericReponse();
    }

    public async login(request: Express.Request, username: string, password: string, totp: string, requestexpirydate?: boolean) {
        // const { req }: { req: Express.Request } = context;
        const result = await this.db.collections.users_collection.findOne({ 'life.deletedTime': null, 'username': username });
        if (!result) {
            throw new GraphQLError('User does not exist.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        const passwordMatched = await bcrypt.compare(password, result.password);
        if (!passwordMatched) {
            throw new GraphQLError('Incorrect password.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        // validate the TOTP
        const totpValidated = mfa.verifyTOTP(totp, result.otpSecret);
        if (!totpValidated) {
            if (process.env['NODE_ENV'] === 'development')
                console.warn('Incorrect One-Time password. Continuing in development ...');
            else
                throw new GraphQLError('Incorrect One-Time password.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        /* validate if account expired */
        if (result.expiredAt < Date.now() && result.type === enumUserTypes.STANDARD) {
            if (requestexpirydate) {
                /* send email to the DMP admin mailing-list */
                await this.mailer.sendMail(formatEmailRequestExpiryDatetoAdmin({
                    config: this.emailConfig,
                    userEmail: result.email,
                    username: result.username
                }));
                /* send email to client */
                await this.mailer.sendMail(formatEmailRequestExpiryDatetoClient({
                    config: this.emailConfig,
                    to: result.email,
                    username: result.username
                }));
                throw new GraphQLError('New expiry date has been requested! Wait for ADMIN to approve.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
            }

            throw new GraphQLError('Account Expired. Please request a new expiry date!', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        const filteredResult: IUserWithoutToken = { ...result };

        return new Promise<unknown>((resolve, reject) => {
            request.login(filteredResult, (err: unknown) => {
                if (err) {
                    Logger.error(err);
                    reject(new GraphQLError('Cannot log in. Please try again later.'));
                    return;
                }

                resolve({
                    ...filteredResult,
                    createdAt: filteredResult.life.createdTime,
                    deleted: filteredResult.life.deletedTime
                });
            });
        });
    }
    public async logout(request: Express.Request) {
        const requester = request.user;
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return new Promise<IGenericResponse>((resolve) => {
            request.logout((err) => {
                if (err) {
                    Logger.error(err);
                    throw new GraphQLError('Cannot log out');
                } else {
                    resolve(makeGenericReponse(requester.id));
                }
            });
        });
    }

    public async createUser(user: CreateUserInput) {
        /* check email is valid form */
        if (!/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/.test(user.email)) {
            throw new GraphQLError('Email is not the right format.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        /* check password validity */
        if (user.password && !passwordIsGoodEnough(user.password)) {
            throw new GraphQLError('Password has to be at least 8 character long.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        /* check that username and password dont have space */
        if (user.username.indexOf(' ') !== -1 || user.password.indexOf(' ') !== -1) {
            throw new GraphQLError('Username or password cannot have spaces.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        const alreadyExist = await this.db.collections.users_collection.findOne({ 'username': user.username, 'life.deletedTime': null }); // since bycrypt is CPU expensive let's check the username is not taken first
        if (alreadyExist !== null && alreadyExist !== undefined) {
            throw new GraphQLError('User already exists.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        /* check if email has been used to register */
        const emailExist = await this.db.collections.users_collection.findOne({ 'email': user.email, 'life.deletedTime': null });
        if (emailExist !== null && emailExist !== undefined) {
            throw new GraphQLError('This email has been registered. Please sign-in or register with another email!', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }

        /* randomly generate a secret for Time-based One Time Password*/
        const otpSecret = mfa.generateSecret();
        const hashedPassword: string = await bcrypt.hash(user.password, this.config.bcrypt.saltround);
        const createdAt = Date.now();
        const expiredAt = Date.now() + 86400 * 1000 /* millisec per day */ * 90;
        const entry: IUser = {
            id: uuid(),
            username: user.username,
            otpSecret,
            type: enumUserTypes.STANDARD,
            description: user.description ?? '',
            organisation: user.organisation,
            firstname: user.firstname,
            lastname: user.lastname,
            password: hashedPassword,
            email: user.email,
            emailNotificationsActivated: user.emailNotificationsActivated ?? false,
            emailNotificationsStatus: { expiringNotification: false },
            expiredAt,
            resetPasswordRequests: [],
            metadata: {},
            life: {
                createdTime: createdAt,
                createdUser: enumReservedUsers.SYSTEM,
                deletedTime: null,
                deletedUser: null
            }
        };

        const result = await this.db.collections.users_collection.insertOne(entry);
        if (result.acknowledged) {
            const cleared: MarkOptional<IUser, 'password' | 'otpSecret'> = { ...entry };
            delete cleared['password'];
            delete cleared['otpSecret'];
            /* send email to the registered user */
            // get QR Code for the otpSecret.
            const oauth_uri = `otpauth://totp/${this.config.appName}:${user.username}?secret=${otpSecret}&issuer=Data%20Science%20Institute`;
            const tmpobj = tmp.fileSync({ mode: 0o644, prefix: 'qrcodeimg-', postfix: '.png' });

            QRCode.toFile(tmpobj.name, oauth_uri, {}, function (err) {
                if (err) throw new GraphQLError(err.message);
            });

            const attachments = [{ filename: 'qrcode.png', path: tmpobj.name, cid: 'qrcode_cid' }];
            await this.mailer.sendMail({
                from: `${this.config.appName} <${this.config.nodemailer.auth.user}>`,
                to: user.email,
                subject: `[${this.config.appName}] Registration Successful`,
                html: `
                    <p>
                        Dear ${user.firstname},
                    <p>
                    <p>
                        Welcome to the ${this.config.appName} data portal!<br/>
                        Your username is <b>${user.username}</b>.<br/>
                    </p>
                    <p>
                        To login you will need to use a MFA authenticator app for one time passcode (TOTP).<br/>
                        Scan the QRCode below in your MFA application of choice to configure it:<br/>
                        <img src="cid:qrcode_cid" alt="QR code" width="150" height="150" /><br/>
                        If you need to type the token in use <b>${otpSecret.toLowerCase()}</b>
                    </p>
                    <br/>
                    <p>
                        The ${this.config.appName} Team.
                    </p>
                `,
                attachments: attachments
            });
            tmpobj.removeCallback();
            return makeGenericReponse();
        } else {
            throw new GraphQLError('Database error', { extensions: { code: errorCodes.DATABASE_ERROR } });
        }
    }

    public async deleteUser(requester: IUserWithoutToken | undefined, userId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        // user (admin type) cannot delete itself
        if (requester.id === userId) {
            throw new GraphQLError('User cannot delete itself');
        }

        if (requester.type !== enumUserTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        const session = this.db.client.startSession();
        session.startTransaction();
        try {
            /* delete the user */
            await this.db.collections.users_collection.findOneAndUpdate({ 'id': userId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': Date.now(), 'password': 'DeletedUserDummyPassword' } }, { returnDocument: 'after', projection: { 'life.deletedTime': 1 } });

            /* delete all user records in roles related to the study */
            await this.db.collections.roles_collection.updateMany(
                {
                    deleted: null,
                    users: userId
                },
                {
                    $pull: { users: { _id: userId } }
                }
            );

            await session.commitTransaction();
            session.endSession().catch(() => { return; });
            return makeGenericReponse(userId);
        } catch (error) {
            // If an error occurred, abort the whole transaction and
            // undo any changes that might have happened
            await session.abortTransaction();
            session.endSession().catch(() => { return; });
            throw new GraphQLError(`Database error: ${JSON.stringify(error)}`);
        }
    }

    public async resetPassword(encryptedEmail: string, token: string, newPassword: string) {
        /* check password validity */
        if (!passwordIsGoodEnough(newPassword)) {
            throw new GraphQLError('Password has to be at least 8 character long.');
        }

        /* check that username and password dont have space */
        if (newPassword.indexOf(' ') !== -1) {
            throw new GraphQLError('Password cannot have spaces.');
        }

        /* decrypt email */
        if (token.length < 16) {
            throw new GraphQLError(errorCodes.CLIENT_MALFORMED_INPUT);
        }
        const salt = makeAESKeySalt(token);
        const iv = makeAESIv(token);
        let email;
        try {
            email = await decryptEmail(this.config.aesSecret, encryptedEmail, salt, iv);
        } catch (e) {
            throw new GraphQLError('Token is not valid.');
        }

        /* check whether username and token is valid */
        /* not changing password too in one step (using findOneAndUpdate) because bcrypt is costly */
        const TIME_NOW = new Date().valueOf();
        const ONE_HOUR_IN_MILLISEC = 60 * 60 * 1000;
        const user: IUserWithoutToken | null = await this.db.collections.users_collection.findOne({
            email,
            'resetPasswordRequests': {
                $elemMatch: {
                    id: token,
                    timeOfRequest: { $gt: TIME_NOW - ONE_HOUR_IN_MILLISEC },
                    used: false
                }
            },
            'life.deletedTime': null
        });
        if (!user) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        /* randomly generate a secret for Time-based One Time Password*/
        const otpSecret = mfa.generateSecret();

        /* all ok; change the user's password */
        const hashedPw = await bcrypt.hash(newPassword, this.config.bcrypt.saltround);
        const updateResult = await this.db.collections.users_collection.findOneAndUpdate(
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
        if (updateResult === null) {
            throw new GraphQLError(errorCodes.DATABASE_ERROR);
        }

        /* need to log user out of all sessions */
        // TO_DO

        /* send email to the registered user */
        // get QR Code for the otpSecret.
        const oauth_uri = `otpauth://totp/${this.config.appName}:${user.username}?secret=${otpSecret}&issuer=Data%20Science%20Institute`;
        const tmpobj = tmp.fileSync({ mode: 0o644, prefix: 'qrcodeimg-', postfix: '.png' });

        QRCode.toFile(tmpobj.name, oauth_uri, {}, function (err) {
            if (err) throw new GraphQLError(err.message);
        });

        const attachments = [{ filename: 'qrcode.png', path: tmpobj.name, cid: 'qrcode_cid' }];
        await this.mailer.sendMail({
            from: `${this.config.appName} <${this.config.nodemailer.auth.user}>`,
            to: email,
            subject: `[${this.config.appName}] Password reset`,
            html: `
                <p>
                    Dear ${user.firstname},
                <p>
                <p>
                    Your password on ${this.config.appName} is now reset!<br/>
                    You will need to update your MFA application for one-time passcode.<br/>
                </p>
                <p>
                    To update your MFA authenticator app you can scan the QRCode below to configure it:<br/>
                    <img src="cid:qrcode_cid" alt="QR code" width="150" height="150" /><br/>
                    If you need to type the token in use <b>${otpSecret.toLowerCase()}</b>
                </p>
                <br/>
                <p>
                    The ${this.config.appName} Team.
                </p>
            `,
            attachments: attachments
        });
        tmpobj.removeCallback();
        return makeGenericReponse();
    }

    public async editUser(requester: IUserWithoutToken | undefined, user: EditUserInput) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const { id, username, type, firstname, lastname, email, emailNotificationsActivated, emailNotificationsStatus, password, description, organisation, expiredAt, metadata }: {
            id: string, username?: string, type?: enumUserTypes, firstname?: string, lastname?: string, email?: string, emailNotificationsActivated?: boolean, emailNotificationsStatus?: unknown, password?: string, description?: string, organisation?: string, expiredAt?: number, metadata?: unknown
        } = user;
        if (password !== undefined && requester.id !== id) { // only the user themself can reset password
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }
        if (password && !passwordIsGoodEnough(password)) {
            throw new GraphQLError('Password has to be at least 8 character long.');
        }
        if (requester.type !== enumUserTypes.ADMIN && requester.id !== id) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }
        let result;
        if (requester.type === enumUserTypes.ADMIN) {
            result = await this.db.collections.users_collection.findOne({ id, 'life.deletedTime': null });   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
            if (result === null || result === undefined) {
                throw new GraphQLError('User not found');
            }
        }

        const fieldsToUpdate: UpdateFilter<IUser> = {
            type,
            firstname,
            lastname,
            username,
            email,
            emailNotificationsActivated,
            emailNotificationsStatus,
            password,
            description,
            organisation,
            expiredAt,
            metadata: metadata ?? {}
        };

        /* check email is valid form */
        if (email && !/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/.test(email)) {
            throw new GraphQLError('User not updated: Email is not the right format.', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
        }
        if (requester.type !== enumUserTypes.ADMIN && (
            type || firstname || lastname || username || description || organisation
        )) {
            throw new GraphQLError('User not updated: Non-admin users are only authorised to change their password, email or email notification.');
        }

        if (password) { fieldsToUpdate['password'] = await bcrypt.hash(password, this.config.bcrypt.saltround); }
        for (const each of (Object.keys(fieldsToUpdate) as Array<keyof typeof fieldsToUpdate>)) {
            if (fieldsToUpdate[each] === undefined) {
                delete fieldsToUpdate[each];
            }
        }
        if (expiredAt) {
            fieldsToUpdate['emailNotificationsStatus'] = {
                expiringNotification: false
            };
        }
        const updateResult = await this.db.collections.users_collection.findOneAndUpdate({ id, 'life.deletedTime': null }, { $set: fieldsToUpdate }, { returnDocument: 'after' });
        if (updateResult) {
            // New expiry date has been updated successfully.
            if (expiredAt && result) {
                /* send email to client */
                await this.mailer.sendMail(formatEmailRequestExpiryDateNotification({
                    config: this.emailConfig,
                    to: result.email,
                    username: result.username
                }));
            }
            return updateResult;
        } else {
            throw new GraphQLError('Server error; no entry or more than one entry has been updated.');
        }
    }

    public async registerPubkey(pubkeyobj: { pubkey: string, associatedUserId: string, jwtPubkey: string, jwtSeckey: string }): Promise<IPubkey> {
        const { pubkey, associatedUserId, jwtPubkey, jwtSeckey } = pubkeyobj;
        const entry: IPubkey = {
            id: uuid(),
            pubkey,
            associatedUserId,
            jwtPubkey,
            jwtSeckey,
            refreshCounter: 0,
            life: {
                createdTime: Date.now(),
                createdUser: associatedUserId,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };

        const result = await this.db.collections.pubkeys_collection.insertOne(entry);
        if (result.acknowledged) {
            return entry;
        } else {
            throw new GraphQLError('Database error', { extensions: { code: errorCodes.DATABASE_ERROR } });
        }
    }
}

export function makeAESKeySalt(str: string): string {
    return str;
}

export function makeAESIv(str: string): string {
    if (str.length < 16) { throw new Error('IV cannot be less than 16 bytes long.'); }
    return str.slice(0, 16);
}

export async function encryptEmail(aesSecret: string, email: string, keySalt: string, iv: string) {
    const algorithm = 'aes-256-cbc';
    return new Promise((resolve, reject) => {
        crypto.scrypt(aesSecret, keySalt, 32, (err, derivedKey) => {
            if (err) reject(err);
            const cipher = crypto.createCipheriv(algorithm, derivedKey, iv);
            let encoded = cipher.update(email, 'utf8', 'hex');
            encoded += cipher.final('hex');
            resolve(encoded);
        });
    });

}

export async function decryptEmail(aesSecret: string, encryptedEmail: string, keySalt: string, iv: string) {
    const algorithm = 'aes-256-cbc';
    return new Promise((resolve, reject) => {
        crypto.scrypt(aesSecret, keySalt, 32, (err, derivedKey) => {
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

interface IEmailConfig {
    appName: string;
    nodemailer: {
        auth: {
            user: string;
        };
    };
    adminEmail: string;
}

async function formatEmailForForgottenPassword({ config, username, aesSecret, firstname, to, resetPasswordToken, origin }: { config: IEmailConfig, aesSecret: string, resetPasswordToken: string, to: string, username: string, firstname: string, origin: unknown }) {
    const keySalt = makeAESKeySalt(resetPasswordToken);
    const iv = makeAESIv(resetPasswordToken);
    const encryptedEmail = await encryptEmail(aesSecret, to, keySalt, iv);

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

function formatEmailForFogettenUsername({ config, username, to }: { config: IEmailConfig, username: string, to: string }) {
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

function formatEmailRequestExpiryDatetoClient({ config, username, to }: { config: IEmailConfig, username: string, to: string }) {
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

function formatEmailRequestExpiryDatetoAdmin({ config, username, userEmail }: { config: IEmailConfig, username: string, userEmail: string }) {
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

function formatEmailRequestExpiryDateNotification({ config, username, to }: { config: IEmailConfig, username: string, to: string }) {
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

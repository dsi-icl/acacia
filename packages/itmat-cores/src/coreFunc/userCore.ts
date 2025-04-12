import { CoreError, FileUpload, IFile, IPubkey, IResetPasswordRequest, IUser, IUserWithoutToken, defaultSettings, enumConfigType, enumCoreErrors, enumDriveNodeTypes, enumFileCategories, enumFileTypes, enumUserTypes } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { Logger, Mailer, ObjectStore } from '@itmat-broker/itmat-commons';
import { IConfiguration, makeGenericResponse, rsakeygen, rsaverifier, tokengen } from '../utils';
import { FileCore } from './fileCore';
import { ConfigCore } from './configCore';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import * as mfa from '../utils/mfa';
import QRCode from 'qrcode';
import tmp from 'tmp';
import { UpdateFilter } from 'mongodb';
import * as pubkeycrypto from '../utils/pubkeycrypto';
import crypto from 'crypto';
import fs from 'fs';

export class UserCore {
    db: DBType;
    mailer: Mailer;
    config: IConfiguration;
    objStore: ObjectStore;
    fileCore: FileCore;
    configCore: ConfigCore;
    systemSecret: { publickey: string, privatekey: string };
    constructor(db: DBType, mailer: Mailer, config: IConfiguration, objStore: ObjectStore) {
        this.db = db;
        this.mailer = mailer;
        this.config = config;
        this.objStore = objStore;
        this.fileCore = new FileCore(db, objStore);
        this.configCore = new ConfigCore(db);

        // Initialize with empty strings, will be populated in init()
        this.systemSecret = {
            publickey: '',
            privatekey: ''
        };

        // Initialize synchronously to avoid async constructor
        void this.initialize();
    }
    private async initialize(): Promise<void> {
        try {
            // Load the system secret key pairs
            this.systemSecret = {
                publickey: await this.loadKey(this.config.systemKey['pubkey']),
                privatekey: await this.loadKey(this.config.systemKey['privkey'])
            };
            Logger.log('System keys loaded successfully');
        } catch (error) {
            // Handle error but allow system to start
            Logger.error(`Failed to load system keys: ${error}`);
            this.systemSecret = {
                publickey: '',
                privatekey: ''
            };
        }
    }

    /**
     * Load key from text content or file path.
     * @param keyPathOrContent - Either the key content or a file path to the key.
     * @returns The key as a string.
     */
    private async loadKey(keyPathOrContent: string): Promise<string> {
        try {
            if (!keyPathOrContent) {
                Logger.warn('Empty key path or content provided');
                return '';
            }

            if (keyPathOrContent.includes('-----BEGIN')) {
                // Key is provided as direct content
                return keyPathOrContent;
            } else {
                // Key is provided as a file path, read from file
                try {
                    return fs.readFileSync(keyPathOrContent, 'utf8');
                } catch (fileError) {
                    Logger.warn(`Could not read key file at ${keyPathOrContent}: ${fileError}`);
                    return '';
                }
            }
        } catch (error) {
            Logger.warn(`Error processing key: ${error}`);
            return '';
        }
    }

    /**
     * Get a user. One of the parameters should not be null, we will find users by the following order: usreId, username, email.
     *
     * @param requester - The requester.
     * @param userId - The id of the user.
     * @param username - The username of the user.
     * @param email - The email of the user.
     *
     * @return IUserWithoutToken | null - Thu user object; or null if the user does not exist.
     */
    public async getUser(requester: IUserWithoutToken | undefined, userId?: string, username?: string, email?: string): Promise<IUserWithoutToken | null> {
        if (!userId && !username && !email) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'At least one of the parameters should not be empty.'
            );
        }
        if (!requester || (requester.type !== enumUserTypes.ADMIN && ((userId && requester.id !== userId) || (username && requester.username !== username) || (email && requester.email !== email)))) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        let user: IUserWithoutToken | null = null;
        if (userId) {
            user = await this.db.collections.users_collection.findOne({ 'id': userId, 'life.deletedTime': null }, { projection: { password: 0, otpSecret: 0 } });
        } else if (username) {
            user = await this.db.collections.users_collection.findOne({ 'username': username, 'life.deletedTime': null }, { projection: { password: 0, otpSecret: 0 } });
        } else if (email) {
            user = await this.db.collections.users_collection.findOne({ 'email': email, 'life.deletedTime': null }, { projection: { password: 0, otpSecret: 0 } });
        } else {
            return null;
        }

        if (!user) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'User does not exist.'
            );
        }
        return user;
    }

    /**
     * Get all users.
     *
     * @param requester - The id of the requester.
     * @param includeDeleted - Whether to include users that have been deleted.
     *
     * @return IUserWithoutToken[] - The list of users.
     */
    public async getUsers(requester: IUserWithoutToken | undefined, includeDeleted?: boolean): Promise<IUserWithoutToken[]> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester?.type === enumUserTypes.ADMIN) {
            return includeDeleted ? await this.db.collections.users_collection.find({}).toArray() : await this.db.collections.users_collection.find({ 'life.deletedTime': null }).toArray();
        } else {
            // we return users who share files to this user
            const userIds = Array.from(new Set((await this.db.collections.drives_collection.find({ 'sharedUsers.iid': requester?.id }).toArray()).map(el => el.managerId)));
            return await this.db.collections.users_collection.find({ id: { $in: userIds } }).toArray();
        }
    }

    /**
     * Validate the token from the reset password request.
     *
     * @param encryptedEmail - The encrypted email.
     * @param token - The token for resetting password.
     * @returns IGenericResponse
     */
    public async validateResetPassword(encryptedEmail: string, token: string) {
        /* decrypt email */
        const salt = makeAESKeySalt(token);
        const iv = makeAESIv(token);
        let email;
        try {
            email = await decryptEmail(this.config.aesSecret, encryptedEmail, salt, iv);
        } catch (__unused__exception) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Token is not valid.'
            );
        }

        /* check whether username and token is valid */
        /* not changing password too in one step (using findOneAndUpdate) because bcrypt is costly */
        const TIME_NOW = new Date().valueOf();
        const ONE_HOUR_IN_MILLISEC = 60 * 60 * 1000;
        const user: IUser | null = await this.db.collections.users_collection.findOne({
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
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'User does not exist.'
            );
        }
        return makeGenericResponse(user.id, true);
    }

    /**
     * Create a user.
     *
     * @param username - The username of the user, should be unique.
     * @param email - The email address of the user.
     * @param firstname - The first name of the user.
     * @param lastname - The last name of the user.
     * @param organisation - The id of the user's organisation. Should be one of the organisaiton in the database.
     * @param type - The user type of the user.
     * @param emailNotificationsActivated - Whether email notification service is activared.
     * @param password - The password of the user, should be hashed.
     * @param profile - The profile of the user.
     * @param description - The description of the user.
     * @param requester - The id of the requester.
     *
     * @return Partial<IUser> - The object of IUser. Remove private information.
     */
    public async createUser(requester: IUserWithoutToken | undefined, username: string, email: string, firstname: string, lastname: string, organisation: string, type: enumUserTypes, emailNotificationsActivated: boolean, password: string, profile?: FileUpload, description?: string): Promise<Partial<IUser>> {
        /* check email is valid form */
        if (!/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/.test(email)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Email is not the right format.'
            );
        }

        /* check password validity */
        if (password && !passwordIsGoodEnough(password)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Password has to be at least 8 character long.'
            );
        }

        /* check that username and password dont have space */
        if (username.indexOf(' ') !== -1 || password.indexOf(' ') !== -1) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Username or password cannot have spaces.'
            );
        }
        /* randomly generate a secret for Time-based One Time Password*/
        const otpSecret = mfa.generateSecret();

        const user = await this.db.collections.users_collection.findOne({
            $or: [
                { username: username },
                { email: email }
            ]
        });
        if (user) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Username or email already exists.'
            );
        }
        const org = await this.db.collections.organisations_collection.findOne({ 'id': organisation, 'life.deletedTime': null });
        if (!org) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Organisation does not exist.'
            );
        }
        // fetch the config file
        const userConfig = defaultSettings.userConfig;

        const userId: string = uuid();
        const hashedPassword: string = await bcrypt.hash(password, this.config.bcrypt.saltround);
        const expiredAt = Date.now() + 86400 * 1000 /* millisec per day */ * (userConfig.defaultUserExpiredDays);

        const entry: IUser = {
            id: userId,
            username: username,
            email: email,
            firstname: firstname,
            lastname: lastname,
            organisation: organisation,
            type: type,
            emailNotificationsActivated: emailNotificationsActivated,
            emailNotificationsStatus: {
                expiringNotification: false
            },
            resetPasswordRequests: [],
            password: hashedPassword,
            otpSecret: otpSecret,
            profile: undefined,
            description: description ?? '',
            expiredAt: expiredAt,
            life: {
                createdTime: Date.now(),
                createdUser: requester?.id ?? userId,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };
        let fileEntry: IFile;
        if (profile) {
            if (!Object.keys(enumFileTypes).includes((profile?.filename?.split('.').pop() || '').toUpperCase())) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'File type not supported.'
                );
            }
            fileEntry = await this.fileCore.uploadFile(entry, null, userId, profile,
                enumFileTypes[(profile.filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes], enumFileCategories.PROFILE_FILE);
            entry.profile = fileEntry?.id;
        }
        await this.db.collections.users_collection.insertOne(entry);

        const driveId = uuid();
        await this.db.collections.drives_collection.insertOne({
            id: driveId,
            path: [driveId],
            restricted: true,
            name: 'My Drive',
            description: 'This is your own drive.',
            fileId: null,
            type: enumDriveNodeTypes.FOLDER,
            parent: null,
            children: [],
            sharedUsers: [],
            life: {
                createdTime: Date.now(),
                createdUser: userId,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {},
            managerId: userId
        });

        // add a default user config
        await this.db.collections.configs_collection.insertOne({
            id: uuid(),
            type: enumConfigType.USERCONFIG,
            key: userId,
            life: {
                createdTime: Date.now(),
                createdUser: userId,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {},
            properties: userConfig
        });

        /* send email to the registered user */
        // get QR Code for the otpSecret.
        const oauth_uri = `otpauth://totp/${this.config.appName}:${username}?secret=${otpSecret}&issuer=Data%20Science%20Institute`;
        const tmpobj = tmp.fileSync({ mode: 0o644, prefix: 'qrcodeimg-', postfix: '.png' });

        QRCode.toFile(tmpobj.name, oauth_uri, {}, function (err) {
            if (err) {
                throw new CoreError(
                    enumCoreErrors.UNQUALIFIED_ERROR,
                    err.message
                );
            }
        });

        const attachments = [{ filename: 'qrcode.png', path: tmpobj.name, cid: 'qrcode_cid' }];
        await this.mailer.sendMail({
            from: `${this.config.appName} <${this.config.nodemailer.auth.user}>`,
            to: email,
            subject: `[${this.config.appName}] Registration Successful`,
            html: `
                    <p>
                        Dear ${firstname},
                    <p>
                    <p>
                        Welcome to the ${this.config.appName} data portal!<br/>
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
                        The ${this.config.appName} Team.
                    </p>
                `,
            attachments: attachments
        });
        tmpobj.removeCallback();

        return entry;
    }

    /**
     * Edit an existing user. Note, this function will use all default values, so if you want to keep some fields the same, you need to first fetch the original values as the inputs.
     *
     * @param requester - The id of the requester.
     * @param userId - The id of the user.
     * @param username - The username of the user, should be unique.
     * @param email - Optional. The emailAddress of the user.
     * @param firstname - Optional. The first name of the user.
     * @param lastname - Optional. The last name of the user.
     * @param organisation - Optional. The id of the user's organisation. Should be one of the organisaiton in the database.
     * @param type - Optional. The user type of the user.
     * @param emailNotificationsActivated - Optional. Whether email notification service is activared.
     * @param password - Optional. The password of the user, should be hashed.
     * @param otpSecret - Optional. The otp secret of the user.
     * @param profile - Optional. The image of the profile of the user. Could be null.
     * @param description - Optional. The description of the user.
     * @param expiredAt - Optional. The expired timestamps of the user.
     *
     * @return Partial<IUser> - The object of IUser. Remove private information.
     */
    public async editUser(requester: IUserWithoutToken | undefined, userId: string, username?: string, email?: string, firstname?: string, lastname?: string, organisation?: string, type?: enumUserTypes, emailNotificationsActivated?: boolean, password?: string, otpSecret?: string, profile?: FileUpload, description?: string, expiredAt?: number): Promise<Partial<IUser>> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        if (requester.type !== enumUserTypes.ADMIN && requester.id !== userId) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'User can only edit his/her own account.'
            );
        }

        if (requester.type !== enumUserTypes.ADMIN && (type || expiredAt)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'Standard user can not change their type, expiration time. Please contact admins for help.'
            );
        }

        if ((password || otpSecret) && requester.id !== userId) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'User can only edit his/her own account.'
            );
        }

        if (password && !passwordIsGoodEnough(password)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Password has to be at least 8 character long.'
            );
        }

        /* check that username and password dont have space */
        if ((username && username.indexOf(' ') !== -1) || (password && password.indexOf(' ') !== -1)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Username or password cannot have spaces.'
            );
        }

        /* check email is valid form */
        if (email && !/^([a-zA-Z0-9_\-.]+)@([a-zA-Z0-9_\-.]+)\.([a-zA-Z]{2,5})$/.test(email)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Email is not the right format.'
            );
        }

        if (expiredAt && expiredAt < Date.now()) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Cannot set to a previous time.'
            );
        }


        const user = await this.db.collections.users_collection.findOne({ 'id': userId, 'life.deletedTime': null });
        if (!user) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'User does not exist.'
            );
        }
        const setObj: UpdateFilter<IUser> = {};
        if (username && username !== user.username) {
            const existUsername = await this.db.collections.users_collection.findOne({ 'username': username, 'life.deletedTime': null });
            if (existUsername) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Username already used.'
                );
            }
            setObj['username'] = username;
        }

        if (email && email !== user.email) {
            const existEmail = await this.db.collections.users_collection.findOne({ 'email': email, 'life.deletedTime': null });
            if (existEmail) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Email already used.'
                );
            }
            setObj['email'] = email;
        }

        if (firstname) {
            setObj['firstname'] = firstname;
        }

        if (lastname) {
            setObj['lastname'] = lastname;
        }

        if (description) {
            setObj['description'] = description;
        }

        if (emailNotificationsActivated) {
            setObj['emailNotificationsActivated'] = emailNotificationsActivated;
        }

        if (organisation) {
            const org = await this.db.collections.organisations_collection.findOne({ 'id': organisation, 'life.deletedTime': null });
            if (!org) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Organisation does not exist.'
                );
            }
            setObj['organisation'] = organisation;
        }

        if (password) {
            const hashedPassword: string = await bcrypt.hash(password, this.config.bcrypt.saltround);
            if (await bcrypt.compare(password, user.password)) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'You need to select a new password.'
                );
            }
            setObj['password'] = hashedPassword;
        }

        if (otpSecret) {
            setObj['otpSecret'] = otpSecret;
        }

        let fileEntry;
        if (profile) {
            if (!Object.keys(enumFileTypes).includes((profile?.filename?.split('.').pop() || '').toUpperCase())) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'File type not supported.'
                );
            }
            fileEntry = await this.fileCore.uploadFile(requester, null, user.id, profile, enumFileTypes[(profile.filename.split('.').pop() || '').toUpperCase() as keyof typeof enumFileTypes], enumFileCategories.PROFILE_FILE);
            setObj['profile'] = fileEntry.id;
        }

        if (expiredAt) {
            setObj['expiredAt'] = expiredAt;
        }

        const result = await this.db.collections.users_collection.findOneAndUpdate({ id: user.id }, {
            $set: setObj
        }, {
            returnDocument: 'after'
        });
        if (!result) {
            throw new CoreError(
                enumCoreErrors.DATABASE_ERROR,
                enumCoreErrors.DATABASE_ERROR
            );
        } else {
            if (expiredAt) {
                /* send email to client */
                await this.mailer.sendMail(formatEmailRequestExpiryDateNotification({
                    config: this.config,
                    to: result.email,
                    username: result.username
                }));
            }
            return result;
        }
    }

    /**
     * Delete an user.
     *
     * @param requester - The requester.
     * @param userId - The id of the user.
     *
     * @return IGenericResponse - General response.
     */
    public async deleteUser(requester: IUserWithoutToken | undefined, userId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        /* Admins can delete anyone, while general user can only delete themself */
        if (!(requester.type === enumUserTypes.ADMIN) && !(requester.id === userId)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'User can only delete his/her own account.'
            );
        }
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        /* Admins can delete anyone, while general user can only delete themself */
        if (!(requester.type === enumUserTypes.ADMIN) && !(requester.id === userId)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }
        const user = await this.db.collections.users_collection.findOne({ 'id': userId, 'life.deletedTime': null });
        if (!user) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'User does not exist.'
            );
        }

        const session = this.db.client.startSession();
        session.startTransaction();
        try {
            /* delete the user */
            await this.db.collections.users_collection.findOneAndUpdate({ 'id': userId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': Date.now(), 'life.deletedUser': requester.id, 'password': 'DeletedUserDummyPassword', 'otpSecret': 'DeletedUserDummpOtpSecret' } }, { returnDocument: 'after' });

            /* delete all user records in roles related to the study */
            await this.db.collections.roles_collection.updateMany({
                'life.deletedTime': null,
                'users': userId
            }, {
                $pull: { users: userId }
            });

            await session.commitTransaction();
            await session.endSession();
            return makeGenericResponse(userId, true, undefined, `User ${user.username} has been deleted.`);
        } catch (error) {
            // If an error occurred, abort the whole transaction and
            // undo any changes that might have happened
            await session.abortTransaction();
            await session.endSession();
            throw new CoreError(
                enumCoreErrors.DATABASE_ERROR,
                String(error)
            );
        }
    }

    /**
     * Get keys of a user.
     *
     * @param requester - The requester.
     * @param userId - The id of the user.
     */
    public async getUserKeys(requester: IUserWithoutToken | undefined, userId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        if (requester.type !== enumUserTypes.ADMIN && requester.id !== userId) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'User can only get his/her own keys.'
            );
        }
        return await this.db.collections.pubkeys_collection.find({ 'associatedUserId': userId, 'life.deletedTime': null }).toArray();
    }

    /**
     * Generate a key pair for a user.
     *
     * @returns - The key pair.
     */
    public async keyPairGenwSignature() {
        // Generate RSA key-pair with Signature for robot user
        const keyPair = pubkeycrypto.rsakeygen();
        //default message = hash of the public key (SHA256)
        const messageToBeSigned = pubkeycrypto.hashdigest(keyPair.publicKey);
        const signature = pubkeycrypto.rsasigner(keyPair.privateKey, messageToBeSigned);

        return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, signature: signature };
    }

    /**
     * Sign a message with a private key.
     *
     * @param privateKey - The private key.
     * @param message - The message to be signed.
     *
     * @returns - The signature.
     */
    public async rsaSigner(privateKey, message) {
        let messageToBeSigned;
        privateKey = privateKey.replace(/\\n/g, '\n');
        if (message === undefined) {
            //default message = hash of the public key (SHA256)
            try {
                const reGenPubkey = pubkeycrypto.reGenPkfromSk(privateKey);
                messageToBeSigned = pubkeycrypto.hashdigest(reGenPubkey);
            } catch (__unused__exception) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    'Error: private-key incorrect!'
                );
            }

        } else {
            messageToBeSigned = message;
        }
        const signature = pubkeycrypto.rsasigner(privateKey, messageToBeSigned);
        return { signature: signature };
    }

    /**
     * Register a pubkey to a user.
     *
     * @param requester - The id of the requester.
     * @param pubkey - The public key.
     * @param signature - The signature of the key.
     * @param associatedUserId - The user whom to attach the publick key to.
     *
     * @return IPubkey - The object of ther registered key.
     */
    public async registerPubkey(requester: IUserWithoutToken | undefined, pubkey: string, hashedPrivateKey: string | undefined, associatedUserId: string): Promise<IPubkey> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        if (requester.type !== enumUserTypes.ADMIN && requester.id !== associatedUserId) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'User can only register his/her own public key.'
            );
        }

        // refine the public-key parameter from browser
        pubkey = pubkey.replace(/\\n/g, '\n');
        const alreadyExist = await this.db.collections.pubkeys_collection.findOne({ pubkey, 'life.deletedTime': null });
        if (alreadyExist) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'This public-key has already been registered.'
            );
        }

        const user = await this.db.collections.users_collection.findOne({ 'id': requester.id, 'life.deletedTime': null });
        if (!user) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'User does not exist.'
            );
        }

        /* Generate a public key-pair for generating and authenticating JWT access token later */
        const keypair = rsakeygen();

        const entry: IPubkey = {
            id: uuid(),
            pubkey: pubkey,
            hashedPrivateKey: hashedPrivateKey,
            associatedUserId: associatedUserId,
            jwtPubkey: keypair.publicKey,
            jwtSeckey: keypair.privateKey,
            refreshCounter: 0,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            challenge: null,
            lastUsedTime: null,
            metadata: {}
        };

        await this.db.collections.pubkeys_collection.insertOne(entry);
        return entry;
    }
    /**
     * Generate a random challenge.
     *
     * @param length - The length of the challenge.
     * @returns - The challenge.
     */
    public generateChallenge(length) {
        // Generate a random buffer of the desired byte length
        const randomBytes = crypto.randomBytes(length / 2); // `length / 2` to get a hex string of desired length
        // Convert the buffer to a hex string and return it
        return randomBytes.toString('hex').slice(0, length);
    }

    /**
     * Request an access token.
     *
     * @param username - The username.
     * @param pubkeyKey - The public key.
     * @returns - The challenge.
     */
    public async requestAccessToken(username: string, hashedPrivateKey: string) {
        const user = await this.db.collections.users_collection.findOne({ 'username': username, 'life.deletedTime': null });
        if (!user) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'This public-key has not been registered yet.'
            );
        }
        const pubkeyrec = await this.db.collections.pubkeys_collection.findOne({ 'associatedUserId': user.id, 'hashedPrivateKey': hashedPrivateKey, 'life.deletedTime': null });

        if (!pubkeyrec) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'This public-key has not been registered yet.'
            );
        }
        const challenge = this.generateChallenge(128);
        const hashedChallenge = crypto.createHash('sha256').update(challenge).digest('hex');
        await this.db.collections.pubkeys_collection.findOneAndUpdate({ id: pubkeyrec.id }, { $set: { challenge: hashedChallenge } });
        return { challenge: hashedChallenge };
    }

    /**
     * Get an access token.
     *
     * @param username - The username.
     * @param pubkeyKey - The public key.
     * @param signature - The signature.
     * @param life - The life of the token.
     * @returns - The token.
     */
    public async getAccessToken(username: string, hashedPrivateKey: string, signature: string, life = 120000) {
        const user = await this.db.collections.users_collection.findOne({ 'username': username, 'life.deletedTime': null });
        if (!user) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'This public-key has not been registered yet.'
            );
        }
        const pubkeyrec = await this.db.collections.pubkeys_collection.findOne({ 'associatedUserId': user.id, 'hashedPrivateKey': hashedPrivateKey, 'life.deletedTime': null });
        if (!pubkeyrec) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'This public-key has not been registered yet.'
            );
        }

        if (!pubkeyrec.challenge) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Please request a challenge first.'
            );
        }
        const isVerified = crypto.verify(
            null,  // No hash algorithm because the challenge is already hashed
            Buffer.from(pubkeyrec.challenge, 'hex'),  // Convert the hex-encoded challenge to binary
            {
                key: pubkeyrec.pubkey,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING
            },
            Buffer.from(signature, 'hex')  // Decode the Base64-encoded signature
        );

        if (!isVerified) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Signature is not correct.'
            );
        }
        const token = tokengen({
            username: user.username,
            publicKey: pubkeyrec.jwtPubkey
        }, pubkeyrec.jwtSeckey, undefined, undefined, life);

        await this.db.collections.pubkeys_collection.findOneAndUpdate({ id: pubkeyrec.id }, { $set: { lastUsedTime: Date.now() } });
        return token;
    }
    /**
     * Issue an access token.
     *
     * @param pubkey - The public key.
     * @param signature - The signature of the key.
     * @param life - The life of the token.
     * @returns
     */
    public async issueAccessToken(pubkey: string, signature: string, life = 120000) {
        // refine the public-key parameter from browser
        pubkey = pubkey.replace(/\\n/g, '\n');

        /* Validate the signature with the public key */
        if (!await rsaverifier(pubkey, signature)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Signature vs Public key mismatched.'
            );
        }

        const pubkeyrec = await this.db.collections.pubkeys_collection.findOne({ pubkey, deleted: null });
        if (pubkeyrec === null || pubkeyrec === undefined) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'This public-key has not been registered yet.'
            );
        }

        // payload of the JWT for storing user information
        const payload = {
            publicKey: pubkeyrec.jwtPubkey,
            associatedUserId: pubkeyrec.associatedUserId,
            refreshCounter: pubkeyrec.refreshCounter,
            Issuer: 'IDEA-FAST DMP'
        };

        // update the counter
        const fieldsToUpdate = {
            refreshCounter: (pubkeyrec.refreshCounter + 1)
        };
        const updateResult = await this.db.collections.pubkeys_collection.findOneAndUpdate({ pubkey, deleted: null }, { $set: fieldsToUpdate }, { returnDocument: 'after' });
        if (!updateResult) {
            throw new CoreError(
                enumCoreErrors.DATABASE_ERROR,
                enumCoreErrors.DATABASE_ERROR
            );
        }
        // return the acccess token
        const accessToken = {
            accessToken: tokengen(payload, pubkeyrec.jwtSeckey, undefined, undefined, life)
        };

        return accessToken;
    }

    public async issueSystemAccessToken(userId: string, life?: number | null) {
        /**
         * Get the user to verify existence
         * Minimal payload for system token
         * @param userId - The id of the user.
         * @param life - The life of the token.
         * @returns
         */
        // Get the user to verify existence
        const user = await this.db.collections.users_collection.findOne(
            { 'id': userId, 'life.deletedTime': null },
            { projection: { password: 0, otpSecret: 0 } }
        );

        if (!user) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'User does not exist.'
            );
        }

        // Minimal payload for system token
        const payload = {
            publicKey: this.systemSecret.publickey,
            userId: user.id,
            isSystemToken: true,
            issuer: 'IDEA-FAST DMP SYSTEM',
            timestamp: Date.now()
        };

        // set the life time to one year if not specified
        life = life || (365 * 24 * 60 * 60 * 1000);

        const accessToken = {
            accessToken: tokengen(payload, this.systemSecret.privatekey, undefined, undefined, life)
        };

        return accessToken;
    }


    /**
     * Delete a pubkey.
     *
     * @param requester - The requester.
     * @param userId - The id of the user.
     * @param keyId - The id of the key.
     * @returns IGenericResponse
     */
    public async deletePubkey(requester: IUserWithoutToken | undefined, associatedUserId: string, keyId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        if (requester.type !== enumUserTypes.ADMIN && requester.id !== associatedUserId) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'User can only delete his/her own public key.'
            );
        }
        const key = await this.db.collections.pubkeys_collection.findOne({
            'id': keyId,
            'associatedUserId': associatedUserId,
            'life.deletedTime': null
        });
        if (!key) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Key does not exist.'
            );
        }
        if (key.associatedUserId !== associatedUserId) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'The key does not match the user.'
            );
        }

        await this.db.collections.pubkeys_collection.findOneAndUpdate({ id: keyId }, {
            $set: {
                'life.deletedTime': Date.now(),
                'life.deletedUser': requester.id
            }
        });

        return makeGenericResponse(keyId, true, undefined, undefined);
    }

    /**
     * Add a reset password request to the user.
     *
     * @param userId - The id of the user.
     * @param resetPasswordRequest - The reset password request.
     * @returns IGenericResponse
     */
    public async addResetPasswordRequest(userId: string, resetPasswordRequest: IResetPasswordRequest) {
        const invalidateAllTokens = await this.db.collections.users_collection.findOneAndUpdate(
            { id: userId },
            {
                $set: {
                    'resetPasswordRequests.$[].used': true
                }
            }
        );
        if (!invalidateAllTokens) {
            throw new CoreError(
                enumCoreErrors.DATABASE_ERROR,
                enumCoreErrors.DATABASE_ERROR
            );
        }
        const updateResult = await this.db.collections.users_collection.findOneAndUpdate(
            { id: userId },
            {
                $push: {
                    resetPasswordRequests: resetPasswordRequest
                }
            }
        );
        if (!updateResult) {
            throw new CoreError(
                enumCoreErrors.DATABASE_ERROR,
                enumCoreErrors.DATABASE_ERROR
            );
        }

        return makeGenericResponse(resetPasswordRequest.id, true, undefined, undefined);
    }

    public async processResetPasswordRequest(token: string, email: string, password: string) {
        /* check whether username and token is valid */
        /* not changing password too in one step (using findOneAndUpdate) because bcrypt is costly */
        const TIME_NOW = new Date().valueOf();
        const ONE_HOUR_IN_MILLISEC = 60 * 60 * 1000;
        const user = await this.db.collections.users_collection.findOne({
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
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'User does not exist.'
            );
        }

        /* randomly generate a secret for Time-based One Time Password*/
        const otpSecret = mfa.generateSecret();

        /* all ok; change the user's password */
        const hashedPw = await bcrypt.hash(password, this.config.bcrypt.saltround);
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
        if (!updateResult) {
            throw new CoreError(
                enumCoreErrors.DATABASE_ERROR,
                enumCoreErrors.DATABASE_ERROR
            );
        }

        return updateResult;
    }

    /**
     * Ask for a request to extend account expiration time. Send notifications to user and admin.
     *
     * @param email - The email of the user.
     *
     * @return IGenericResponse
     */
    public async requestExpiryDate(username?: string, email?: string) {
        if ((!username && !email) || (username && email)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Either username or email should be provided.'
            );
        }

        const user = username ? await this.db.collections.users_collection.findOne({ username }) : await this.db.collections.users_collection.findOne({ email });
        if (!user || !user.email || !user.username) {
            /* even user is null. send successful response: they should know that a user doesn't exist */
            await new Promise(resolve => setTimeout(resolve, Math.random() * 6000));
            return makeGenericResponse(email, false, undefined, 'User information is not correct.');
        }
        /* send email to the DMP admin mailing-list */
        await this.mailer.sendMail(formatEmailRequestExpiryDatetoAdmin({
            config: this.config,
            userEmail: user.email,
            username: user.username
        }));

        /* send email to client */
        await this.mailer.sendMail(formatEmailRequestExpiryDatetoClient({
            config: this.config,
            to: user.email,
            username: user.username
        }));

        return makeGenericResponse(email, true, undefined, 'Request successfully sent.');
    }

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
    public async requestUsernameOrResetPassword(forgotUsername: boolean, forgotPassword: boolean, origin: string, email?: string, username?: string) {
        /* checking the args are right */
        if ((forgotUsername && !email) // should provide email if no username
            || (forgotUsername && username) // should not provide username if it's forgotten.
            || (!email && !username)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Inputs are invalid.'
            );
        } else if (email && username) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Inputs are invalid.'
            );
        }

        /* check user existence */
        const user = await this.db.collections.users_collection.findOne({ '$or': [{ email }, { username }], 'life.deletedTime': null });
        if (!user) {
            /* even user is null. send successful response: they should know that a user doesn't exist */
            await new Promise(resolve => setTimeout(resolve, Math.random() * 6000));
            return makeGenericResponse(undefined, true, undefined, enumCoreErrors.UNQUALIFIED_ERROR);
        }

        if (forgotPassword) {
            /* make link to change password */
            const passwordResetToken = uuid();
            const resetPasswordRequest: IResetPasswordRequest = {
                id: passwordResetToken,
                timeOfRequest: new Date().valueOf(),
                used: false
            };
            await this.addResetPasswordRequest(user.id ?? '', resetPasswordRequest);

            /* send email to client */
            await this.mailer.sendMail(await formatEmailForForgottenPassword({
                config: this.config,
                to: user.email ?? '',
                resetPasswordToken: passwordResetToken,
                username: user.username ?? '',
                firstname: user.firstname ?? '',
                origin: origin
            }));
        } else {
            /* send email to client */
            await this.mailer.sendMail(formatEmailForFogettenUsername({
                config: this.config,
                to: user.email ?? '',
                username: user.username ?? ''
            }));
        }
        return makeGenericResponse(user.id, true, undefined, 'Request of resetting password successfully sent.');
    }

    /**
     * Login a user.
     *
     * @param req - The request object.
     * @param username - The username of the user.
     * @param password - The password of the user.
     * @param totp - The one-time password of the user.
     * @returns IUserWithoutToken
     */
    public async login(req: Express.Request, username: string, password: string, totp: string, requestExpiryDate?: boolean) {
        const user = await this.db.collections.users_collection.findOne({ username });
        if (!user || !user.password || !user.otpSecret || !user.email || !user.username) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'User does not exist.'
            );
        }

        const passwordMatched = await bcrypt.compare(password, user.password);
        if (!passwordMatched) {
            if (process.env['NODE_ENV'] === 'development')
                console.warn('Incorrect password. Continuing in development ...');
            else {
                throw new CoreError(
                    enumCoreErrors.AUTHENTICATION_ERROR,
                    'Incorrect password.'
                );
            }
        }

        /* validate the TOTP */
        const totpValidated = mfa.verifyTOTP(totp, user.otpSecret);
        if (!totpValidated) {
            if (process.env['NODE_ENV'] === 'development')
                console.warn('Incorrect One-Time password. Continuing in development ...');
            else {
                throw new CoreError(
                    enumCoreErrors.AUTHENTICATION_ERROR,
                    'Incorrect One-Time password.'
                );
            }
        }

        /* validate if account expired */
        if (user.expiredAt && user.expiredAt < Date.now() && user.type === enumUserTypes.STANDARD) {
            if (requestExpiryDate) {
                /* send email to the DMP admin mailing-list */
                await this.mailer.sendMail(formatEmailRequestExpiryDatetoAdmin({
                    config: this.config,
                    userEmail: user.email,
                    username: user.username
                }));
                /* send email to client */
                await this.mailer.sendMail(formatEmailRequestExpiryDatetoClient({
                    config: this.config,
                    to: user.email,
                    username: user.username
                }));
                throw new CoreError(
                    enumCoreErrors.UNQUALIFIED_ERROR,
                    'New expiry date has been requested! Wait for ADMIN to approve.'
                );
            }
            throw new CoreError(
                enumCoreErrors.AUTHENTICATION_ERROR,
                'Account Expired. Please request a new expiry date!'
            );
        }

        const { password: __unusedPassword, otpSecret: __unusedOtpSecret, ...filteredUser } = user;
        return new Promise((resolve) => {
            req.login(filteredUser, (err) => {
                if (err) {
                    Logger.error(err);
                    throw new CoreError(
                        enumCoreErrors.AUTHENTICATION_ERROR,
                        'Cannot log in. Please try again later.'
                    );
                }
                resolve(filteredUser as IUserWithoutToken);
            });
        });
    }

    public async logout(requester: IUserWithoutToken | undefined, req: Express.Request) {
        if (!requester) {
            return makeGenericResponse(undefined, false, undefined, 'Requester not known.');
        }
        return new Promise((resolve) => {
            req.logout((err) => {
                if (err) {
                    Logger.error(err);
                    throw new CoreError(
                        enumCoreErrors.AUTHENTICATION_ERROR,
                        'Cannot log out. Please try again later.'
                    );
                } else {
                    resolve(makeGenericResponse(requester.id));
                }
            });
        });
    }

    /**
     *  Reset password.
     * @param encryptedEmail - The encrypted email.
     * @param token - The token.
     * @param newPassword - The new password.
     * @returns IGnericResponse
     */
    public async resetPassword(encryptedEmail: string, token: string, newPassword: string) {
        if (!passwordIsGoodEnough(newPassword)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Password has to be at least 8 character long.'
            );
        }

        /* check that username and password dont have space */
        if (newPassword.indexOf(' ') !== -1) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Password cannot have spaces.'
            );
        }

        /* decrypt email */
        if (token.length < 16) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Token is invalid.'
            );
        }

        // TODO
        const salt = makeAESKeySalt(token);
        const iv = makeAESIv(token);
        let email;
        try {
            email = await decryptEmail(this.config.aesSecret, encryptedEmail, salt, iv);
        } catch (__unused__exception) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Token is invalid.'
            );
        }

        const user = await this.processResetPasswordRequest(token, email, newPassword);
        /* need to log user out of all sessions */
        // TO_DO

        /* send email to the registered user */
        // get QR Code for the otpSecret.
        const oauth_uri = `otpauth://totp/${this.config.appName}:${user.username}?secret=${user.otpSecret}&issuer=Data%20Science%20Institute`;
        const tmpobj = tmp.fileSync({ mode: 0o644, prefix: 'qrcodeimg-', postfix: '.png' });

        QRCode.toFile(tmpobj.name, oauth_uri, {}, function (err) {
            if (err) {
                throw new CoreError(
                    enumCoreErrors.UNQUALIFIED_ERROR,
                    err.message
                );
            }
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
                    If you need to type the token in use <b>${(user.otpSecret as string).toLowerCase()}</b>
                </p>
                <br/>
                <p>
                    The ${this.config.appName} Team.
                </p>
            `,
            attachments: attachments
        });
        tmpobj.removeCallback();
        return makeGenericResponse();
    }

    /**
     * Ping the server. This will refresh the session expire time.
     *
     * @returns - IGenericResponse
     */
    public async recoverSessionExpireTime() {
        return makeGenericResponse();
    }


}

function passwordIsGoodEnough(pw: string): boolean {
    if (pw.length < 8) {
        return false;
    }
    return true;
}

async function formatEmailForForgottenPassword({ config, username, firstname, to, resetPasswordToken, origin }: { config: IConfiguration, resetPasswordToken: string, to: string, username: string, firstname: string, origin: string }) {
    const keySalt = makeAESKeySalt(resetPasswordToken);
    const iv = makeAESIv(resetPasswordToken);
    const encryptedEmail = await encryptEmail(config.aesSecret, to, keySalt, iv);

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

function formatEmailForFogettenUsername({ config, username, to }: { config: IConfiguration, username: string, to: string }) {
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

export function formatEmailRequestExpiryDatetoClient({ config, username, to }: { config: IConfiguration, username: string, to: string }) {
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

export function formatEmailRequestExpiryDatetoAdmin({ config, username, userEmail }: { config: IConfiguration, username: string, userEmail: string }) {
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

function formatEmailRequestExpiryDateNotification({ config, username, to }: { config: IConfiguration, username: string, to: string }) {
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

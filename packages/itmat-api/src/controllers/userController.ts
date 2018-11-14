import { ItmatAPIReq } from '../server/requests';
import { CustomError, Models, RequestValidationHelper, UserControllerBasic } from 'itmat-utils';
import mongodb, { UpdateWriteOpResult, Collection } from 'mongodb';
import { Express, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';

export class UserController extends UserControllerBasic {
    constructor(private readonly usersCollection: mongodb.Collection, private readonly bcryptSaltRound: number = 4) {
        super();
        this.getUsers = this.getUsers.bind(this);
        this.createNewUser = this.createNewUser.bind(this);
        this.deleteUser = this.deleteUser.bind(this);
        this.editUser = this.editUser.bind(this);
        this.login = this.login.bind(this);
        this.logout = this.logout.bind(this);
        this._createNewUser = this._createNewUser.bind(this);
        this._deleteUser = this._deleteUser.bind(this);
        this._getAllUsers = this._getAllUsers.bind(this);
        this._getUser = this._getUser.bind(this);
        this.serialiseUser = this.serialiseUser.bind(this);
        this.deserialiseUser = this.deserialiseUser.bind(this);
    }

    public async getUsers(req: ItmatAPIReq<undefined>, res: Response) {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkForAdminPrivilege()
            .checksFailed) { return; }

        if (req.query && req.query.username) {   // if there is query.username then only get that user; if not then get all users;
            // check query.usernmae = []; XXXX
            let result: Models.UserModels.IUserWithoutToken;
            try {
                result = await this._getUser(req.query.username);

                if (validator
                    .checkSearchResultIsNotDefinedNorNull(result, 'user')
                    .checksFailed)  { return; }

                res.status(200).json(result);
                return;
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
        } else {
            let result: Models.UserModels.IUserWithoutToken[];
            try {
                result = await this._getAllUsers();
                res.status(200).json(result);
                return;
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
        }
    }

    public async createNewUser(req: ItmatAPIReq<requests.CreateUserReqBody>, res: Response) {
        const validator = new RequestValidationHelper(req, res);

        if (validator
            .checkForAdminPrivilege()
            .checkRequiredKeysArePresentIn<requests.CreateUserReqBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['username', 'password', 'type'])
            .checkKeyForValidValue('type', req.body.type, Object.keys(Models.UserModels.userTypes))
            .checkForValidDataTypeForValue(req.body.password, Models.Enums.JSDataType.STRING, 'password')
            .checkForValidDataTypeForValue(req.body.username, Models.Enums.JSDataType.STRING, 'username')
            .checksFailed)  { return; }

        const alreadyExist = await this._getUser(req.body.username); // since bycrypt is CPU expensive let's check the username is not taken first
        if (alreadyExist !== undefined && alreadyExist !== null) {
            res.status(400).json(new CustomError('Username already taken!'));
            return;
        }

        const hashedPassword: string = await bcrypt.hash(req.body.password, this.bcryptSaltRound);
        const entry: Models.UserModels.IUser = {
            username: req.body.username,
            password: hashedPassword,
            type: req.body.type as Models.UserModels.userTypes,
            deleted: false,
            createdBy: req.user!.username
        };

        let result: mongodb.InsertOneWriteOpResult;
        try {
            result = await this._createNewUser(entry);
        } catch (e) {
            res.status(500).json(new CustomError('Database error', e));
            return;
        }

        if (result.insertedCount === 1) {
            res.status(200).json({ message: `Created user ${req.body.username}`});
        } else {
            res.status(500).json({ message: 'Server error.'});
        }
        return;
    }

    public async login(req: ItmatAPIReq<requests.LoginReqBody>, res: Response): Promise<void> {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkRequiredKeysArePresentIn<requests.LoginReqBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['password', 'username'])
            .checkForValidDataTypeForValue(req.body.password, Models.Enums.JSDataType.STRING, 'password')
            .checkForValidDataTypeForValue(req.body.username, Models.Enums.JSDataType.STRING, 'username')
            .checksFailed)  { return; }

        const result: Models.UserModels.IUser = await this.usersCollection.findOne({ deleted: false, username: req.body.username });  // not getUser() because we need the pw as well
        if (!result) {
            res.status(401).json(new CustomError('Incorrect username'));
            return;
        }
        const passwordMatched = await bcrypt.compare(req.body.password, result.password);
        // const passwordMatched = req.body.password === result.password;
        if (!passwordMatched) {
            res.status(401).json(new CustomError('Incorrect password'));
            return;
        }
        delete result.password;
        req.login(result, err => {
            if (err) { console.log(err); res.status(401).json(new CustomError('Username and password are correct but cannot login.')); return; }
            res.status(200).json({ message: 'Logged in!' });
        });
    }

    public async logout(req: ItmatAPIReq<requests.LogoutReqBody>, res: Response) {
        const validator = new RequestValidationHelper(req, res);
        const { PlaceToCheck } = Models.APIModels.Enums;
        const { JSDataType } = Models.Enums;
        if (validator
            .checkRequiredKeysArePresentIn<requests.LogoutReqBody>(PlaceToCheck.BODY, ['user'])
            .checkForAdminPrivilegeOrSelf()
            .checkForValidDataTypeForValue(req.body.user, JSDataType.STRING, 'user')
            .checksFailed)  { return; }
        (req.session as Express.Session).destroy(err => {
            if (req.user === undefined || req.user === null) {
                res.status(401).json(new CustomError('Not logged in in the first place!'));
                return;
            }
            req.logout();
            if (err) {
                res.status(500).json(new CustomError('Cannot destroy session', err));
            } else {
                res.status(200).json({ message: 'Successfully logged out' });
            }
            return;
        });
    }

    public async deleteUser(req: ItmatAPIReq<requests.DeleteUserReqBody>, res: Response) {
        const validator = new RequestValidationHelper(req, res);
        const { PlaceToCheck } = Models.APIModels.Enums;
        const { JSDataType } = Models.Enums;
        if (validator
            .checkRequiredKeysArePresentIn<requests.DeleteUserReqBody>(PlaceToCheck.BODY, ['user'])
            .checkForAdminPrivilegeOrSelf()
            .checkForValidDataTypeForValue(req.body.user, JSDataType.STRING, 'user')
            .checksFailed) { return; }

        let updateResult: mongodb.UpdateWriteOpResult;
        try {
            updateResult = await this._deleteUser(req.body.user);
        } catch (e) {
            res.status(500).json(new CustomError('Database error', e));
            return;
        }

        if (validator
            .checkSearchResultIsOne('user', updateResult.modifiedCount)
            .checksFailed) { return; }

        if (req.user!.username === req.body.user) {
            req.logout();
        }

        res.status(200).json({ message: `User ${req.body.user} has been deleted.`});
        return;
    }

    public async editUser(req: ItmatAPIReq<requests.EditUserReqBody>, res: Response, next: NextFunction) {  /// LOG OUT ALL SESSIONS OF THAT USER?
        /* admin is allow to change everything except username. user himself is allowed to change password only (i.e. not privilege) */

        const validator = new RequestValidationHelper(req, res);
        const { PlaceToCheck } = Models.APIModels.Enums;
        const { JSDataType } = Models.Enums;
        if (validator
            .checkRequiredKeysArePresentIn<requests.EditUserReqBody>(PlaceToCheck.BODY, ['user'])
            .checkForAdminPrivilegeOrSelf()
            .checkForValidDataTypeForValue(req.body.user, JSDataType.STRING, 'user')
            .checksFailed) { return; }

        if (req.user!.type === Models.UserModels.userTypes.ADMIN) {
            try {
                const result: Models.UserModels.IUserWithoutToken = await this._getUser(req.body.user);   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
                if (result === null || result === undefined) {
                    res.status(404).json(new CustomError('user not found'));
                    return;
                }
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
            const fieldsToUpdate: any = {};
            if (req.body.password) { fieldsToUpdate.password = await bcrypt.hash(req.body.password, this.bcryptSaltRound); }
            if (req.body.type) {
                if (!Object.keys(Models.UserModels.userTypes).includes(req.body.type)) {
                    res.status(400).json(new CustomError(Models.APIModels.Errors.invalidReqKeyValue('type', Object.keys(Models.UserModels.userTypes))));
                    return;
                }
                fieldsToUpdate.type = req.body.type;
            }

            if (Object.keys(fieldsToUpdate).length === 0) {
                res.status(400).json(new CustomError('Did not provide any field to update.'));
                return;
            }

            try {
                const updateResult: UpdateWriteOpResult = await this.usersCollection.updateOne({ username: req.body.user, deleted: false }, { $set: fieldsToUpdate });
                if (updateResult.modifiedCount === 1) {
                    res.status(200).json({ message: `User ${req.body.user} has been updated.`});
                    return;
                } else {
                    res.status(500).json(new CustomError('Server error; no entry or more than one entry has been updated.'));
                    return;
                }
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
        } else {
            if (req.body.type !== undefined) {
                res.status(401).json(new CustomError('Non-admin users are not authorised to change user type.'));
                return;
            }
            const fieldsToUpdate: any = {};
            if (req.body.password) { fieldsToUpdate.password = await bcrypt.hash(req.body.password, this.bcryptSaltRound); }

            if (Object.keys(fieldsToUpdate).length === 0) {
                res.status(400).json(new CustomError('Did not provide any field to update.'));
                return;
            }

            try {
                const updateResult: UpdateWriteOpResult = await this.usersCollection.updateOne({ username: req.body.user, deleted: false }, { $set: fieldsToUpdate });
                if (updateResult.modifiedCount === 1) {
                    res.status(200).json({ message: `User ${req.body.user} has been updated.`});
                    return;
                } else {
                    res.status(500).json(new CustomError('Server error; no entry or more than one entry has been updated.'));
                    return;
                }
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
        }
    }

    public serialiseUser(user: Models.UserModels.IUser, done: Function): void { //tslint:disable-line
        done(null, user.username);
    }

    public async deserialiseUser(username: string, done: Function): Promise<void> { //tslint:disable-line
        const user: Models.UserModels.IUserWithoutToken = await this._getUser(username);
        done(null, user);
    }

    private async _getAllUsers(): Promise<Models.UserModels.IUserWithoutToken[]> {
        const cursor: mongodb.Cursor = this.usersCollection.find({ deleted: false }, { projection: { password: 0, _id: 0, createdBy: 0 }});
        return await cursor.toArray();
    }

    private async _getUser(username: string): Promise<Models.UserModels.IUserWithoutToken> {
        return await this.usersCollection.findOne({ deleted: false, username }, { projection: { _id: 0, deleted: 0, password: 0 }});
    }

    private async _createNewUser(user: Models.UserModels.IUser): Promise<mongodb.InsertOneWriteOpResult> {
        user.deleted = false;
        return await this.usersCollection.insertOne(user);
    }

    private async _deleteUser(username: string): Promise<UpdateWriteOpResult> {
        return await this.usersCollection.updateOne( { deleted: false, username }, { $set: { deleted: true }});
    }
}

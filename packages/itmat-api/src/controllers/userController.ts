import { UserUtils } from '../utils/userUtils';
import { APIDatabase } from '../database/database';
import { ItmatAPIReq } from '../server/requests';
import { CustomError, Models, RequestValidationHelper, UserControllerBasic } from 'itmat-utils';
import mongodb, { UpdateWriteOpResult } from 'mongodb';
import { Express, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import config from '../../config/config.json';

export class UserController extends UserControllerBasic {
    public static async getUsers(req: ItmatAPIReq<undefined>, res: Response) {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkForAdminPrivilege()
            .checksFailed) return;

        if (req.query && req.query.username) {   //if there is query.username then only get that user; if not then get all users;
            // check query.usernmae = []; XXXX
            let result: Models.UserModels.IUserWithoutToken;
            try {
                result = await UserUtils.getUser(req.query.username);

                if (validator
                    .checkSearchResultIsNotDefinedNorNull(result, 'user')
                    .checksFailed) return;
                
                res.status(200).json(result);
                return;
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
        } else {
            let result: Models.UserModels.IUserWithoutToken[];
            try {
                result = await UserUtils.getAllUsers();
                res.status(200).json(result);
                return;
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
        }
    }

    public static async createNewUser(req: ItmatAPIReq<requests.CreateUserReqBody>, res: Response) {
        const validator = new RequestValidationHelper(req, res);
        
        if (validator
            .checkForAdminPrivilege()
            .checkRequiredKeysArePresentIn<requests.CreateUserReqBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['username', 'password', 'type'])
            .checkKeyForValidValue('type', req.body.type, Object.keys(Models.UserModels.userTypes))
            .checkForValidDataTypeForValue(req.body.password, Models.Enums.JSDataType.STRING, 'password')
            .checkForValidDataTypeForValue(req.body.username, Models.Enums.JSDataType.STRING, 'username')
            .checksFailed) return;

        const alreadyExist = await UserUtils.getUser(req.body.username); //since bycrypt is CPU expensive let's check the username is not taken first
        if (alreadyExist !== undefined && alreadyExist !== null) {
            res.status(400).json(new CustomError('Username already taken!'));
            return;
        }

        const hashedPassword: string = await bcrypt.hash(req.body.password, config.bcrypt.saltround);
        const entry: Models.UserModels.IUser = {
            username: req.body.username,
            password: hashedPassword,
            type: req.body.type as Models.UserModels.userTypes,
            deleted: false,
            createdBy: req.user.username
        };

        let result: mongodb.InsertOneWriteOpResult;
        try {
            result = await UserUtils.createNewUser(entry);
        } catch(e) {
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

    public static async login(req: ItmatAPIReq<requests.LoginReqBody>, res: Response): Promise<void> {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkRequiredKeysArePresentIn<requests.LoginReqBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['password', 'username'])
            .checkForValidDataTypeForValue(req.body.password, Models.Enums.JSDataType.STRING, 'password')
            .checkForValidDataTypeForValue(req.body.username, Models.Enums.JSDataType.STRING, 'username')
            .checksFailed) return;
        
        const result: Models.UserModels.IUser = await APIDatabase.users_collection.findOne({ deleted: false, username: req.body.username });  //not getUser() because we need the pw as well
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
        req.login(result, (err) => {
            if (err) { console.log(err); res.status(401).json(new CustomError('Username and password are correct but cannot login.')); return; }
            res.status(200).json({ message: 'Logged in!' });
        });
    }

    public static async logout(req: ItmatAPIReq<requests.LogoutReqBody>, res: Response) {
        const validator = new RequestValidationHelper(req, res);
        const { PlaceToCheck } = Models.APIModels.Enums;
        const { JSDataType } = Models.Enums;
        if (validator
            .checkRequiredKeysArePresentIn<requests.LogoutReqBody>(PlaceToCheck.BODY, ['user'])
            .checkForAdminPrivilegeOrSelf()
            .checkForValidDataTypeForValue(req.body.user, JSDataType.STRING, 'user')
            .checksFailed) return;
            console.log('hey');
        (req.session as Express.Session).destroy((err) => {
            if (req.user === undefined || req.user === null) {
                res.status(401).json(new CustomError('Not logged in in the first place!'));
                return;
            }
            req.logout();
            if (err) {
                res.status(500).json(new CustomError('Cannot destroy session', err));
            }
            else {
                res.status(200).json({ message: 'Successfully logged out' });
            }
            return;
        });
    }

    public static async deleteUser(req: ItmatAPIReq<requests.DeleteUserReqBody>, res: Response) {
        const validator = new RequestValidationHelper(req, res);
        const { PlaceToCheck } = Models.APIModels.Enums;
        const { JSDataType } = Models.Enums;
        if (validator
            .checkRequiredKeysArePresentIn<requests.DeleteUserReqBody>(PlaceToCheck.BODY, ['user'])
            .checkForAdminPrivilegeOrSelf()
            .checkForValidDataTypeForValue(req.body.user, JSDataType.STRING, 'user')
            .checksFailed) return;

        let updateResult: mongodb.UpdateWriteOpResult;
        try {
            updateResult = await UserUtils.deleteUser(req.body.user);
        } catch (e) {
            res.status(500).json(new CustomError('Database error', e));
            return;
        }

        if (validator
            .checkSearchResultIsOne('user', updateResult.modifiedCount)
            .checksFailed) return;

        if (req.user.username === req.body.user) {
            req.logout();
        }

        res.status(200).json({ message: `User ${req.body.user} has been deleted.`});
        return;
    }

    public static async editUser(req: ItmatAPIReq<requests.EditUserReqBody>, res: Response, next: NextFunction) {  ///LOG OUT ALL SESSIONS OF THAT USER?
        /* admin is allow to change everything except username. user himself is allowed to change password only (i.e. not privilege) */
        const validator = new RequestValidationHelper(req, res);
        const { PlaceToCheck } = Models.APIModels.Enums;
        const { JSDataType } = Models.Enums;
        if (validator
            .checkRequiredKeysArePresentIn<requests.EditUserReqBody>(PlaceToCheck.BODY, ['user'])
            .checkForAdminPrivilegeOrSelf()
            .checkForValidDataTypeForValue(req.body.user, JSDataType.STRING, 'user')
            .checksFailed) return;

        if (req.user.type === Models.UserModels.userTypes.ADMIN) {
            try {
                const result: Models.UserModels.IUserWithoutToken = await UserUtils.getUser(req.body.user);   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
                if (result === null || result === undefined) {
                    res.status(404).json(new CustomError('user not found'));
                    return;
                }
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
            const fieldsToUpdate: any = {};
            if (req.body.password) { fieldsToUpdate.password = await bcrypt.hash(req.body.password, config.bcrypt.saltround); }
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
                const updateResult: UpdateWriteOpResult = await APIDatabase.users_collection.updateOne({ username: req.body.user, deleted: false }, { $set: fieldsToUpdate });
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
            if (req.body.password) { fieldsToUpdate.password = await bcrypt.hash(req.body.password, config.bcrypt.saltround); }

            if (Object.keys(fieldsToUpdate).length === 0) {
                res.status(400).json(new CustomError('Did not provide any field to update.'));
                return;
            }

            try {
                const updateResult: UpdateWriteOpResult = await APIDatabase.users_collection.updateOne({ username: req.body.user, deleted: false }, { $set: fieldsToUpdate });
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
} 
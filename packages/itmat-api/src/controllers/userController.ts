import { UserUtils, UserWithoutToken, User } from '../utils/userUtils';
import { APIDatabase } from '../database/database';
import { ItmatAPIReq } from '../server/requests';
import { CustomError, userTypes, APIErrorTypes, RequestValidationHelper, PlaceToCheck, JSDataType } from 'itmat-utils';
import mongodb, { UpdateWriteOpResult } from 'mongodb';
import { Express, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import config from '../config/config.json';

export class UserController {
    // @bounceNonAdmin
    public static async getUsers(req: ItmatAPIReq<undefined>, res: Response) {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkForAdminPrivilege()
            .allOkay === false) return;

        if (req.query && req.query.username) {   //if there is query.username then only get that user; if not then get all users;
            let result: UserWithoutToken;
            try {
                result = await UserUtils.getUser(req.query.username);

                if (validator
                    .checkSearchResultIsNotDefinedNorNull(result, 'user')
                    .allOkay === false) return;
                
                res.status(200).json(result);
                return;
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
        } else {
            let result: UserWithoutToken[];
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
            .checkRequiredKeysArePresentIn<requests.CreateUserReqBody>(PlaceToCheck.BODY, ['username', 'password', 'type'])
            .checkKeyForValidValue('type', req.body.type, Object.keys(userTypes))
            .checkForValidDataTypeForValue(req.body.password, JSDataType.STRING, 'password')
            .checkForValidDataTypeForValue(req.body.username, JSDataType.STRING, 'username')
            .allOkay === false) return;

        const alreadyExist = await UserUtils.getUser(req.body.username); //since bycrypt is CPU expensive let's check the username is not taken first
        if (alreadyExist !== undefined && alreadyExist !== null) {
            res.status(400).json(new CustomError('Username already taken!'));
            return;
        }

        const hashedPassword: string = await bcrypt.hash(req.body.password, config.bcrypt.saltround);
        const entry: User = {
            username: req.body.username,
            password: hashedPassword,
            type: req.body.type,
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
            .checkRequiredKeysArePresentIn<requests.LoginReqBody>(PlaceToCheck.BODY, ['password', 'username'])
            .checkForValidDataTypeForValue(req.body.password, JSDataType.STRING, 'password')
            .checkForValidDataTypeForValue(req.body.username, JSDataType.STRING, 'username')
            .allOkay === false) return;
        
        const result: User = await APIDatabase.users_collection.findOne({ deleted: false, username: req.body.username });  //not getUser() because we need the pw as well
        if (!result) {
            res.status(401).json(new CustomError('Incorrect username'));
        }
        const passwordMatched = await bcrypt.compare(req.body.password, result.password);
        // const passwordMatched = req.body.password === result.password;
        if (!passwordMatched) {
            res.status(401).json(new CustomError('Incorrect password'));
        }
        delete result.password;
        req.login(result, (err) => {
            if (err) { res.status(401).json(new CustomError('Username and password are correct but cannot login.')); return; }
            res.status(200).json({ message: 'Logged in!' });
        });
    }

    public static async logout(req: ItmatAPIReq<requests.LogoutReqBody>, res: Response) {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkRequiredKeysArePresentIn<requests.LogoutReqBody>(PlaceToCheck.BODY, ['user'])
            .checkForAdminPrivilegeOrSelf()
            .checkForValidDataTypeForValue(req.body.user, JSDataType.STRING, 'user')
            .allOkay === false) return;

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
        if (validator
            .checkRequiredKeysArePresentIn<requests.DeleteUserReqBody>(PlaceToCheck.BODY, ['user'])
            .checkForAdminPrivilegeOrSelf()
            .checkForValidDataTypeForValue(req.body.user, JSDataType.STRING, 'user')
            .allOkay === false) return;

        let updateResult: mongodb.UpdateWriteOpResult;
        try {
            updateResult = await UserUtils.deleteUser(req.body.user);
        } catch (e) {
            res.status(500).json(new CustomError('Database error', e));
            return;
        }

        if (validator
            .checkSearchResultIsOne('user', updateResult.modifiedCount)
            .allOkay === false ) return;

        if (req.user.username === req.body.user) {
            req.logout();
        }

        res.status(200).json({ message: `User ${req.body.user} has been deleted.`});
        return;
    }

    public static async editUser(req: ItmatAPIReq<requests.EditUserReqBody>, res: Response, next: NextFunction) {  ///LOG OUT ALL SESSIONS OF THAT USER?
        /* admin is allow to change everything except username. user himself is allowed to change password only (e.g. not privilege) */
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkRequiredKeysArePresentIn<requests.EditUserReqBody>(PlaceToCheck.BODY, ['user'])
            .checkForAdminPrivilegeOrSelf()
            .checkForValidDataTypeForValue(req.body.user, JSDataType.STRING, 'user')
            .allOkay === false) return;

        if (req.user.type === userTypes.ADMIN) {
            try {
                const result: UserWithoutToken = await UserUtils.getUser(req.body.user);   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
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
                if (!Object.keys(userTypes).includes(req.body.type)) {
                    res.status(400).json(new CustomError(APIErrorTypes.invalidReqKeyValue('type', Object.keys(userTypes))));
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
        } else if (req.user.username === req.body.user){
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
        } else {
                res.status(401).json(new CustomError(APIErrorTypes.authorised));
                return;
        }
    }

    public static whoAmI(req: Request, res: Response, next: NextFunction): void {
        if (!req.user || req.user.username === undefined) {
            res.status(404).json({ message: 'A unicorn, whose multitude is denominated a blessing, and which is Scotland\'s national animal.'});
            return;
        }
        res.status(200).json(req.user);
        return;
    }


} 
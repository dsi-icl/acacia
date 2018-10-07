import { UserUtils, UserWithoutToken, User } from '../utils/userUtils';
import { APIDatabase } from '../database/database';
import { ItmatAPIReq } from '../server/requests';
import { CustomError, userTypes, APIErrorTypes, bounceNonAdmin, bounceNonAdminAndNonSelf } from 'itmat-utils';
import mongodb, { UpdateWriteOpResult } from 'mongodb';
import { Express, Request, Response, NextFunction } from 'express';
import { RequestValidationHelper } from './validationHelper';
import bcrypt from 'bcrypt';
import config from '../config/config.json';

export class UserController {
    @bounceNonAdmin
    public static async getUsers(req: ItmatAPIReq<undefined>, res: Response) {
        if (req.query && req.query.username) {
            let result: UserWithoutToken;
            try {
                result = await UserUtils.getUser(req.query.username);
                if (result === null || result === undefined) {
                    res.status(404).json(new CustomError('user not found'));
                    return;
                }
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

    // @bounceNonAdmin
    public static async createNewUser(req: ItmatAPIReq<requests.CreateUserReqBody>, res: Response) {
        const validate = new RequestValidationHelper(req, res);
        validate
            .checkForAdminPrivilege()
            .checkKeyForValidValue('type', req.body.type, Object.keys(userTypes));
        if (validate.allOkay === false) {
            return;
        }


        if (typeof req.body.password !== 'string' || typeof req.body.username !== 'string') {
            res.status(400).json(new CustomError('username and password need to be strings.'));
            return;
        }
        // if (!Object.keys(userTypes).includes(req.body.type)) {
        //     res.status(400).json(new CustomError(APIErrorTypes.invalidReqKeyValue('type', ...Object.keys(userTypes))));
        //     return;
        // }

        const alreadyExist = await UserUtils.getUser(req.body.username);
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
        const result: User = await APIDatabase.users_collection.findOne({ deleted: false, username: req.body.username });  //not getUser() before we need the pw as well
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
        if (req.user.username === req.body.username) {
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
        } else {
            res.status(401).json(new CustomError(APIErrorTypes.authorised));
        }
    }

    @bounceNonAdminAndNonSelf
    public static async deleteUser(req: ItmatAPIReq<requests.DeleteUserReqBody>, res: Response) {
        let updateResult: mongodb.UpdateWriteOpResult;
        try {
            updateResult = await UserUtils.deleteUser(req.body.username);
        } catch (e) {
            res.status(500).json(new CustomError('Database error', e));
            return;
        }

        switch (updateResult.modifiedCount) {
            case 1:
                break;
            case 0:
                res.status(404).json(new CustomError('User not found.'));
                return;
            default:
                res.status(500).json(new CustomError('Server error; no entry or more than one entry has been updated.'));
                return;
        }

        if (req.user.username === req.body.username) {
            req.logout();
        }

        res.status(200).json({ message: `User ${req.body.username} has been deleted.`});
        return;
    } 

    public static async editUser(req: ItmatAPIReq<User>, res: Response, next: NextFunction) {  ///LOG OUT ALL SESSIONS OF THAT USER?
        /* admin is allow to change everything except username. user himself is allowed to change password only (e.g. not privilege) */
        if (req.user.type === userTypes.ADMIN) {
            try {
                const result: UserWithoutToken = await UserUtils.getUser(req.body.username);   // just an extra guard before going to bcrypt cause bcrypt is CPU intensive.
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
                const updateResult: UpdateWriteOpResult = await APIDatabase.users_collection.updateOne({ username: req.body.username, deleted: false }, { $set: fieldsToUpdate });
                if (updateResult.modifiedCount === 1) {
                    res.status(200).json({ message: `User ${req.body.username} has been updated.`});
                    return;
                } else {
                    res.status(500).json(new CustomError('Server error; no entry or more than one entry has been updated.'));
                    return;
                }
            } catch (e) {
                res.status(500).json(new CustomError('Server error', e));
                return;
            }
        } else if (req.user.username === req.body.username){
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
                const updateResult: UpdateWriteOpResult = await APIDatabase.users_collection.updateOne({ username: req.body.username, deleted: false }, { $set: fieldsToUpdate });
                if (updateResult.modifiedCount === 1) {
                    res.status(200).json({ message: `User ${req.body.username} has been updated.`});
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
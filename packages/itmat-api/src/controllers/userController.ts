import { UserUtils, UserWithoutToken, User } from '../utils/userUtils';
import { APIDatabase } from '../database/database';
import { ItmatAPIReq } from '../server/requests';
import { CustomError } from 'itmat-utils';
import mongodb from 'mongodb';
import express from 'express';
import passport from 'passport';


export class UserController {
    public static async getAllUsers(req: express.Request, res: express.Response) {

    }

    public static async getUser(req: express.Request, res: express.Response) {

    }

    public static async login(req: ItmatAPIReq<requests.LoginReqBody>, res: express.Response) {
        const result: User = await APIDatabase.users_collection.findOne({ deleted: false, username: req.body.username });
        if (!result) {
            res.status(401).json(new CustomError('Incorrect username'));
        }
        // const passwordMatched = await bcrypt.compare(password, result.token);
        const passwordMatched = req.body.password === result.token;
        if (!passwordMatched) {
            res.status(401).json(new CustomError('Incorrect password'));
        }
        delete result.token;
        req.login(result, (err) => {
            if (err) { res.status(401).json(new CustomError('Username and password are correct but cannot login.')); return; }
            res.status(200).json({ message: 'Logged in!' });
        });
    }


} 
import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { APIDatabase } from '../database/database';
import { ItmatAPIReq } from './requests';
import { UserUtils, UserWithoutToken, User } from '../utils/userUtils';
import { CustomError, checkMustaveKeysInBody, bounceNonAdmin, bounceNonAdminAndNonSelf } from 'itmat-utils';
import { UserController } from '../controllers/userController';
import { Job } from '../utils/jobUtils';
import bodyParser from 'body-parser';
import passport from 'passport';
import session from 'express-session';
import passportLocal from 'passport-local';
import connectMongo from 'connect-mongo';
import { request } from 'http';
const LocalStrategy = passportLocal.Strategy;
const MongoStore = connectMongo(session);


export class Router {
    constructor() {
        const app: Express = express();

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));

        app.use(session({
            secret: 'IAmATeapot',
            store: new MongoStore({ db: APIDatabase.getDB() } as any)
        }));



        app.use(passport.initialize());
        app.use(passport.session());

        passport.serializeUser(UserUtils.serialiseUser);
        passport.deserializeUser(UserUtils.deserialiseUser);
        
        app.route('/login')
            .post(UserController.login as any);
        
        app.use((req: Request, res: Response, next: NextFunction) => {
            if (req.user === undefined) {
                res.status(401).json(new CustomError('Unauthorised: You are not logged in.'));
                return;
            }
            next();
        });

        app.route('/logout')
            .post(UserController.logout as any);

        app.route('/jobs') //job?=1111 or /job
            .get() //get all the jobs the user has created or a specific job (including status)
            .post(
                bounceNonAdmin as any,
                checkMustaveKeysInBody<Job>(['jobType']) as any
            )  //create a new job
            .delete(

            ) //cancel a job    //GDPR?

        app.route('/users')
            .get(
                bounceNonAdmin,
                UserController.getUsers as any
            )  //get all users or a specific user
            .post(
                bounceNonAdmin,
                checkMustaveKeysInBody<requests.CreateUserReqBody>(['username', 'password', 'type']) as any,
                UserController.createNewUser as any
            )
            .patch(
                checkMustaveKeysInBody<User>(['username']) as any,
                /* checking authorisation in the middleware below */
                UserController.editUser as any
            )
            .delete(
                bounceNonAdminAndNonSelf,
                checkMustaveKeysInBody<requests.DeleteUserReqBody>(['username']) as any,
                UserController.deleteUser as any
            ) //delete a user

        return app;
    }
}
import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { APIDatabase } from '../database/database';
import { ItmatAPIReq } from './requests';
import { UserUtils, UserWithoutToken, User } from '../utils/userUtils';
import { CustomError, checkMusthaveKeysIn, PlaceToCheck, bounceNotLoggedIn } from 'itmat-utils';
import { UserController } from '../controllers/userController';
import { JobController } from '../controllers/jobController';
import { Job, JobUtils, JobEntry } from '../utils/jobUtils';
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
        
        app.route('/whoAmI')
            .get(UserController.whoAmI);

        app.route('/login')
            .post(UserController.login as any);
        
        app.use(bounceNotLoggedIn);

        app.route('/logout')
            .post(UserController.logout as any);

        app.route('/jobs') //job?=1111 or /job
            .get(
                JobController.getJobsOfAUser as any
            ) //get all the jobs the user has created or a specific job (including status)
            .post(
                checkMusthaveKeysIn<Job>(PlaceToCheck.BODY,['jobType']),
                JobController.createJobForUser as any
            )  //create a new job
            .delete(
                checkMusthaveKeysIn<JobEntry>(PlaceToCheck.BODY,['id']),
                JobController.cancelJobForUser as any
            ); //cancel a job    //GDPR?

        app.route('/users')
            .get(
                UserController.getUsers as any
            )  //get all users or a specific user
            .post(
                checkMusthaveKeysIn<requests.CreateUserReqBody>(PlaceToCheck.BODY, ['username', 'password', 'type']),
                UserController.createNewUser as any
            )
            .patch(
                checkMusthaveKeysIn<User>(PlaceToCheck.BODY, ['username']),
                /* checking authorisation in the middleware below */ 
                UserController.editUser as any
            )
            .delete(
                checkMusthaveKeysIn<requests.DeleteUserReqBody>(PlaceToCheck.BODY, ['username']),
                UserController.deleteUser as any
            ); //delete a user
        
        app.all('/', function(err: Error, req: Request, res: Response, next: NextFunction) {
            res.status(500).json(new CustomError('Server error.'));
        })

        return app;
    }
}
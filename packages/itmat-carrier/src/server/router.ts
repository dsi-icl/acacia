import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { APIDatabase } from '../database/database';
import { UserUtils, UserWithoutToken, User } from '../utils/userUtils';
import { CustomError, RequestValidationHelper } from 'itmat-utils';
import { Job, JobUtils, JobEntry } from '../utils/jobUtils';
import bodyParser from 'body-parser';
import passport from 'passport';
import session from 'express-session';
import passportLocal from 'passport-local';
import connectMongo from 'connect-mongo';
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
        
        app.all('/', function(err: Error, req: Request, res: Response, next: NextFunction) {
            res.status(500).json(new CustomError('Server error.'));
        })

        return app;
    }
}
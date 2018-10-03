import express from 'express';
import { APIDatabase } from '../database/database';
import { UserUtils } from '../utils/userUtils';
import { UserController } from '../controllers/userController';
import bodyParser from 'body-parser';
import passport from 'passport';
import session from 'express-session';
import passportLocal from 'passport-local';
import connectMongo from 'connect-mongo';
const LocalStrategy = passportLocal.Strategy;
const MongoStore = connectMongo(session);

export class Router {
    constructor() {
        const app = express();

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));

        app.use(session({
            secret: 'IAmATeapot',
            store: new MongoStore({ db: APIDatabase.getDB() } as any)
        }));



        app.use(passport.initialize());
        app.use(passport.session());
        // passport.use(new LocalStrategy(UserUtils.login));
        passport.serializeUser(UserUtils.serialiseUser);
        passport.deserializeUser(UserUtils.deserialiseUser);
        
        app.route('/login')
            .post(UserController.login);
        
        app.route('/logout')
            .post()

        app.route('/uploadJobs') //job?=1111 or /job
            .get() //get all the jobs the user has created or a specific job (including status)
            .post()  //create a new job  /
            .delete() //cancel a job    //GDPR?

        app.route('/users')
            .get()  //get all users  / a specific user
            .post() //create new user
            .patch()   //change user password / privilege etc
            .delete() //delete a user
        
        

        return app;
    }
}
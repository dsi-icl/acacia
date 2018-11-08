import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { APIDatabase } from '../database/database';
import { UserUtils } from '../utils/userUtils';
import { CustomError, RequestValidationHelper } from 'itmat-utils';
import { UserController } from '../controllers/userController';
import { JobController } from '../controllers/jobController';
import { FileController } from '../controllers/fileController';
import bodyParser from 'body-parser';
import passport from 'passport';
import session from 'express-session';
import connectMongo from 'connect-mongo';
import multer from 'multer';
import mongodb from 'mongodb'
const MongoStore = connectMongo(session);

const upload = multer();

export class Router {
    private readonly app: Express;

    constructor(db: mongodb.Db /* the database to save sessions */) {
        this.app = express();

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        this.app.use(session({
            secret: 'IAmATeapot',
            store: new MongoStore({ db: db } as any)
        }));

        this.app.use(passport.initialize());
        this.app.use(passport.session());

        passport.serializeUser(UserUtils.serialiseUser);
        passport.deserializeUser(UserUtils.deserialiseUser);
        
        this.app.route('/whoAmI')
            .get(UserController.whoAmI);

        this.app.route('/login')
            .post(UserController.login as any);
        
        this.app.use(RequestValidationHelper.bounceNotLoggedIn);

        this.app.route('/logout')
            .post(UserController.logout as any);

        this.app.route('/jobs') //job?=1111 or /job
            .get(JobController.getJobsOfAUser as any) //get all the jobs the user has created or a specific job (including status)
            .post(JobController.createJobForUser as any)  //create a new job
            .delete(JobController.cancelJobForUser as any); //cancel a job

        this.app.route('/jobs/:jobId')
            .get(JobController.getASpecificJobForUser) //if it's not the user's, give 404

        this.app.route('/jobs/:jobId/:fileName/fileUpload')
            .post(upload.single('file'), FileController.uploadFile as any);

        this.app.route('/jobs/:jobId/:fileName/fileDownload')
            .get(FileController.downloadFile as any);
    
        this.app.route('/users')
            .get(UserController.getUsers as any)  //get all users or a specific user
            .post(UserController.createNewUser as any)
            .patch(UserController.editUser as any)
            .delete(UserController.deleteUser as any);
        
        this.app.all('/', function(err: Error, req: Request, res: Response, next: NextFunction) {
            res.status(500).json(new CustomError('Server error.'));
        })
    }

    public getApp(): Express {
        return this.app;
    }
}
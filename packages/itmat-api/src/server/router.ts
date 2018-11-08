import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { CustomError, RequestValidationHelper } from 'itmat-utils';
import { JobController, UserController, FileController } from '../controllers';
import bodyParser from 'body-parser';
import passport from 'passport';
import session from 'express-session';
import connectMongo from 'connect-mongo';
import multer from 'multer';
import mongodb from 'mongodb';
const MongoStore = connectMongo(session);

const upload = multer();

export class Router {
    private readonly app: Express;

    constructor(
        db: mongodb.Db /* the database to save sessions */,
        jobController: JobController,
        userController: UserController,
        fileController: FileController
    ) {
        this.app = express();

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        this.app.use(session({
            secret: 'IAmATeapot',
            store: new MongoStore({ db } as any)
        }));

        this.app.use(passport.initialize());
        this.app.use(passport.session());

        passport.serializeUser(userController.serialiseUser);
        passport.deserializeUser(userController.deserialiseUser);

        this.app.route('/whoAmI')
            .get(userController.whoAmI);

        this.app.route('/login')
            .post(userController.login as any);

        this.app.use(RequestValidationHelper.bounceNotLoggedIn);

        this.app.route('/logout')
            .post(userController.logout as any);

        this.app.route('/jobs') // job?=1111 or /job
            .get(jobController.getJobsOfAUser as any) // get all the jobs the user has created or a specific job (including status)
            .post(jobController.createJobForUser as any)  // create a new job
            .delete(jobController.cancelJobForUser as any); // cancel a job

        this.app.route('/jobs/:jobId')
            .get(jobController.getASpecificJobForUser); // if it's not the user's, give 404

        this.app.route('/jobs/:jobId/:fileName/fileUpload')
            .post(upload.single('file'), fileController.uploadFile as any);

        this.app.route('/jobs/:jobId/:fileName/fileDownload')
            .get(fileController.downloadFile as any);

        this.app.route('/users')
            .get(userController.getUsers as any)  // get all users or a specific user
            .post(userController.createNewUser as any)
            .patch(userController.editUser as any)
            .delete(userController.deleteUser as any);

        this.app.all('/', (err: Error, req: Request, res: Response, next: NextFunction) => {
            res.status(500).json(new CustomError('Server error.'));
        });
    }

    public getApp(): Express {
        return this.app;
    }
}
import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { CustomError, RequestValidationHelper } from 'itmat-utils';
import { UserController, FileController, StudyController } from '../controllers';
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
        userController: UserController,
        fileController: FileController,
        studyController: StudyController
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
            .post(userController.login);

        this.app.use(RequestValidationHelper.bounceNotLoggedIn);

        this.app.route('/logout')
            .post(userController.logout);

        // this.app.route('/jobs') // job?=1111 or /job
        //     .get(jobController.getJobsOfAUser as any) // get all the jobs the user has created or a specific job (including status)
        //     .post(jobController.createJobForUser as any)  // create a new job
        //     .delete(jobController.cancelJobForUser as any); // cancel a job

        // this.app.route('/jobs/:jobId')
        //     .get(jobController.getASpecificJobForUser); // if it's not the user's, give 404

        this.app.route('/users')
            .get(userController.getUsers)  // get all users or a specific user
            .post(userController.createNewUser)
            .patch(userController.editUser)
            .delete(userController.deleteUser);

        // this.app.route('/study')
        //     .get()
        //     .post()
        //     .delete();

        this.app.route('/study')
            .post(studyController.createStudy)
            .get(studyController.getStudies);

        this.app.route('/file')
            .get(fileController.downloadFile)
            .post(upload.single('file'), fileController.uploadFile);

        this.app.all('/', (err: Error, req: Request, res: Response, next: NextFunction) => {
            res.status(500).json(new CustomError('Server error.'));
        });
    }

    public getApp(): Express {
        return this.app;
    }
}
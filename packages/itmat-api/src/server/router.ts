import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { CustomError, RequestValidationHelper } from 'itmat-utils';
import { UserController, FileController, StudyController, QueryController } from '../httpcontrollers';
import bodyParser from 'body-parser';
import passport from 'passport';
import session from 'express-session';
import connectMongo from 'connect-mongo';
import multer from 'multer';
import mongodb from 'mongodb';
import { ApolloServer } from 'apollo-server-express';
import { schema } from '../graphql/schema';
import { resolvers } from '../graphql/resolvers';

const MongoStore = connectMongo(session);
const upload = multer();

export class Router {
    private readonly app: Express;

    constructor(
        db: mongodb.Db /* the database to save sessions */,
        userController: UserController,
        fileController: FileController,
        studyController: StudyController,
        queryController: QueryController
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

        const gqlServer = new ApolloServer({
            typeDefs: schema,
            resolvers,
            context: ({ req, res }: any) => ({ req, res, db })
        });

        gqlServer.applyMiddleware({ app: this.app });

        this.app.route('/whoAmI')
            .get(userController.whoAmI);

        this.app.route('/login')
            .post(userController.login);

        this.app.use(RequestValidationHelper.bounceNotLoggedIn);

        this.app.route('/logout')
            .post(userController.logout);

        this.app.route('/users')
            .get(userController.getUsers)  // get all users or a specific user
            .post(userController.createNewUser)
            .patch(userController.editUser)
            .delete(userController.deleteUser);

        this.app.route('/study')
            .post(studyController.createStudy)
            .get(studyController.getStudies);

        // this.app.route('/query/xnat')
        //     .post(/* translate to native */);

        // this.app.route('/query/transmart')
        //     .post();

        this.app.route('/query(/xnat|/transmart)?')
            .post(queryController.createQuery)
            .get();

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
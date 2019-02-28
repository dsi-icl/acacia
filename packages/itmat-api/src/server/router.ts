import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import { CustomError, RequestValidationHelper, Logger } from 'itmat-utils';
import { UserController, FileController } from '../RESTControllers';
import bodyParser from 'body-parser';
import passport from 'passport';
import session from 'express-session';
import connectMongo from 'connect-mongo';
import multer from 'multer';
import http from 'http';
import { ApolloServer, gql } from 'apollo-server-express';
import { schema } from '../graphql/schema';
import { resolvers } from '../graphql/resolvers';
import { Database } from '../database/database';
import cors from 'cors';
const MongoStore = connectMongo(session);
const upload = multer();

export class Router {
    private readonly app: Express;
    private server: http.Server;

    constructor(
        db: Database /* the database to save sessions */,
        userController: UserController,
        fileController: FileController,
        // studyController: StudyController,
        // queryController: QueryController
    ) {
        this.app = express();

        this.app.use(cors({ origin: 'http://localhost:3000', credentials: true }));  // TO_DO: remove in production

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        this.app.use(session({
            secret: 'IAmATeapot',
            store: new MongoStore({ db: db.getDB() } as any)
        }));

        this.app.use(passport.initialize());
        this.app.use(passport.session());

        passport.serializeUser(userController.serialiseUser);
        passport.deserializeUser(userController.deserialiseUser);

        const gqlServer = new ApolloServer({
            typeDefs: schema,
            resolvers,
            context: ({ req, res }: any) => ({ req, res, db }),
            formatError: (error: Error) => {
                // TO_DO: generate a ref uuid for errors so the clients can contact admin
                Logger.error(error);
                return error;
            }
        });

        gqlServer.applyMiddleware({ app: this.app, cors: { origin: 'http://localhost:3000', credentials: true } });

        this.server = http.createServer(this.app);
        gqlServer.installSubscriptionHandlers(this.server);

        // this.app.route('/whoAmI')
        //     .get(userController.whoAmI);

        // this.app.route('/login')
        //     .post(userController.login);

        this.app.use(RequestValidationHelper.bounceNotLoggedIn);

        // this.app.route('/logout')
        //     .post(userController.logout);

        // this.app.route('/users')
        //     .get(userController.getUsers)  // get all users or a specific user
        //     .post(userController.createNewUser)
        //     .patch(userController.editUser)
        //     .delete(userController.deleteUser);

        // this.app.route('/study')
        //     .post(studyController.createStudy)
        //     .get(studyController.getStudies);

        // this.app.route('/query/xnat')
        //     .post(/* translate to native */);

        // this.app.route('/query/transmart')
        //     .post();

        // this.app.route('/query(/xnat|/transmart)?')
        //     .post(queryController.createQuery)
        //     .get();

        this.app.route('/file')
            .get(fileController.downloadFile)
            .post(upload.single('file'), fileController.uploadFile);

        this.app.all('/', (err: Error, req: Request, res: Response, next: NextFunction) => {
            res.status(500).json(new CustomError('Server error.'));
        });
    }

    public getApp(): any {
        return this.server;
    }
}
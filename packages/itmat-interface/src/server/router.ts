import { ApolloServer } from 'apollo-server-express';
import bodyParser from 'body-parser';
// import connectMongo from 'connect-mongo';
import cors from 'cors';
import express from 'express';
import { Express, Request, Response } from 'express';
import session from 'express-session';
import http from 'http';
import { CustomError } from 'itmat-commons';
import passport from 'passport';
// import { db } from '../database/database';
import { resolvers } from '../graphql/resolvers';
import { schema } from '../graphql/schema';
import { fileDownloadController } from '../rest/fileDownload';
import { userLoginUtils } from '../utils/userLoginUtils';
import { IConfiguration } from '../utils/configManager';
import { logPlugin } from '../log/logPlugin';
// const MongoStore = connectMongo(session);

export class Router {
    private readonly app: Express;
    private readonly server: http.Server;

    constructor(config: IConfiguration) {
        this.app = express();

        this.app.use(cors({ origin: 'http://localhost:3000', credentials: true }));  // TO_DO: remove in production

        this.app.use(bodyParser.json({ limit: '50mb' }));
        this.app.use(bodyParser.urlencoded({ extended: true }));


        /* save persistent sessions in mongo */
        this.app.use(session({
            secret: config.sessionsSecret,
            resave: true,
            saveUninitialized: true,
            // store: new MongoStore({ client: db.client })
        }));


        /* authenticating user of the request */
        this.app.use(passport.initialize());
        this.app.use(passport.session());
        passport.serializeUser(userLoginUtils.serialiseUser);
        passport.deserializeUser(userLoginUtils.deserialiseUser);


        /* register apolloserver for graphql requests */
        const gqlServer = new ApolloServer({
            typeDefs: schema,
            resolvers,
            plugins: [
                {
                    serverWillStart() {
                        logPlugin.serverWillStartLogPlugin();
                    }
                },
                {
                    requestDidStart() {
                        return {
                            willSendResponse(requestContext) {
                                logPlugin.requestDidStartLogPlugin(requestContext);
                            }
                        };
                    },
                }
            ],
            context: ({ req, res }) => {
                /* Bounce all unauthenticated graphql requests */
                // if (req.user === undefined && req.body.operationName !== 'login' && req.body.operationName !== 'IntrospectionQuery' ) {  // login and schema introspection doesn't need authentication
                //     throw new ForbiddenError('not logged in');
                // }
                return ({ req, res });
            },
            formatError: (error) => {
                // TO_DO: generate a ref uuid for errors so the clients can contact admin
                // TO_DO: check if the error is not thrown my me manually then switch to generic error to client and log
                // Logger.error(error);
                return error;
            }
        });
        gqlServer.applyMiddleware({ app: this.app, cors: { origin: 'http://localhost:3000', credentials: true } });


        /* register the graphql subscription functionalities */
        this.server = http.createServer(this.app);
        gqlServer.installSubscriptionHandlers(this.server);


        /* Bounce all unauthenticated non-graphql HTTP requests */
        // this.app.use((req: Request, res: Response, next: NextFunction) => {
        //     if (req.user === undefined || req.user.username === undefined) {
        //         res.status(401).json(new CustomError('Please log in first.'));
        //         return;
        //     }
        //     next();
        // });

        this.app.get('/file/:fileId', fileDownloadController);

        this.app.all('/', (err: Error, req: Request, res: Response) => {
            res.status(500).json(new CustomError('Server error.'));
        });
    }

    public getApp(): http.Server {
        return this.server;
    }
}

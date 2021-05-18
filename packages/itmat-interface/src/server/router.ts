import { ApolloServer, UserInputError } from 'apollo-server-express';
import bodyParser from 'body-parser';
// import connectMongo from 'connect-mongo';
import cors from 'cors';
import express from 'express';
import { Express } from 'express';
import session from 'express-session';
import http from 'http';
import passport from 'passport';
// import { db } from '../database/database';
import { resolvers } from '../graphql/resolvers';
import { schema } from '../graphql/schema';
import { fileDownloadController } from '../rest/fileDownload';
import { userLoginUtils } from '../utils/userLoginUtils';
import { IConfiguration } from '../utils/configManager';
import { logPlugin } from '../log/logPlugin';
import { spaceFixing } from '../utils/regrex';
import { BigIntResolver as scalarResolvers } from 'graphql-scalars';
import jwt from 'jsonwebtoken';
import { userRetrieval } from '../authentication/pubkeyAuthentication';
// const MongoStore = connectMongo(session);

export class Router {
    private readonly app: Express;
    private readonly server: http.Server;

    constructor(config: IConfiguration) {
        this.app = express();

        if (process.env.NODE_ENV === 'development')
            this.app.use(cors({ credentials: true }));

        this.app.use(bodyParser.json({ limit: '50mb' }));
        this.app.use(bodyParser.urlencoded({ extended: true }));


        /* save persistent sessions in mongo */
        this.app.use (
            session ({
                secret: config.sessionsSecret,
                saveUninitialized: false,
                resave: true,
                rolling: true,
                cookie: {
                    maxAge: 2 * 60 * 60 * 1000 /* 2 hour */
                }
            })
        );


        /* authenticating user of the request */
        this.app.use(passport.initialize());
        this.app.use(passport.session());
        passport.serializeUser(userLoginUtils.serialiseUser);
        passport.deserializeUser(userLoginUtils.deserialiseUser);

        /* register apolloserver for graphql requests */
        const gqlServer = new ApolloServer({
            typeDefs: schema,
            resolvers: {
                ...resolvers,
                BigInt: scalarResolvers
            },
            plugins: [
                {
                    serverWillStart() {
                        logPlugin.serverWillStartLogPlugin();
                    }
                },
                {
                    requestDidStart() {
                        return {
                            executionDidStart(requestContext) {
                                const operation = requestContext.operationName;
                                const actionData = requestContext.request.variables;
                                (requestContext as any).request.variables = spaceFixing(operation, actionData);
                            },
                            willSendResponse(requestContext) {
                                logPlugin.requestDidStartLogPlugin(requestContext);
                            }
                        };
                    },
                }
            ],
            context: async ({ req, res }) => {
                /* Bounce all unauthenticated graphql requests */
                // if (req.user === undefined && req.body.operationName !== 'login' && req.body.operationName !== 'IntrospectionQuery' ) {  // login and schema introspection doesn't need authentication
                //     throw new ForbiddenError('not logged in');
                // }
                const token = req.headers.authorization || '';
                if ((token !== '') && (req.user === undefined)) {
                    // get the decoded payload ignoring signature, no symmetric secret or asymmetric key needed
                    const decodedPayload = jwt.decode(token);
                    // obtain the public-key of the robot user in the JWT payload
                    const pubkey = decodedPayload.publicKey;

                    // verify the JWT
                    jwt.verify(token, pubkey, function(err) {
                        if (err) {
                            throw new UserInputError('JWT verification failed. ' + err);
                        }
                    });
                    // store the associated user with the JWT to context
                    const associatedUser = await userRetrieval(pubkey);
                    req.user = associatedUser;
                }
                return ({ req, res });
            },
            formatError: (error) => {
                // TO_DO: generate a ref uuid for errors so the clients can contact admin
                // TO_DO: check if the error is not thrown my me manually then switch to generic error to client and log
                // Logger().error(error);
                return error;
            }
        });

        gqlServer.applyMiddleware({ app: this.app, cors: { credentials: true } });

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

    }

    public getApp(): Express {
        return this.app;
    }

    public getServer(): http.Server {
        return this.server;
    }
}

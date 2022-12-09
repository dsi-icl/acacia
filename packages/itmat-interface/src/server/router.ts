import { ApolloServer } from '@apollo/server';
import { ApolloServerErrorCode } from '@apollo/server/errors';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { GraphQLError } from 'graphql';
import { graphqlUploadExpress, GraphQLUpload } from 'graphql-upload-minimal';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
// import connectMongo from 'connect-mongo';
// import cors from 'cors';
import express from 'express';
import { Express } from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import http from 'http';
import passport from 'passport';
// import { db } from '../database/database';
import { resolvers } from '../graphql/resolvers';
import { typeDefs } from '../graphql/typeDefs';
import { fileDownloadController } from '../rest/fileDownload';
import { userLoginUtils } from '../utils/userLoginUtils';
import { IConfiguration } from '../utils/configManager';
import { logPlugin } from '../log/logPlugin';
import { spaceFixing } from '../utils/regrex';
import { BigIntResolver as scalarResolvers } from 'graphql-scalars';
import jwt from 'jsonwebtoken';
import { userRetrieval } from '../authentication/pubkeyAuthentication';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import qs from 'qs';
import { IUser } from '@itmat-broker/itmat-types';

interface ApolloServerContext {
    token?: string;
}


export class Router {
    private readonly app: Express;
    private readonly server: http.Server;
    private readonly config: IConfiguration;
    public readonly proxies: Array<RequestHandler> = [];

    constructor(config: IConfiguration) {

        this.config = config;
        this.app = express();

        this.app.use(rateLimit({
            windowMs: 1 * 60 * 1000,
            max: 500
        }));

        // if (process.env.NODE_ENV === 'development')
        //     this.app.use(cors({ credentials: true }));

        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true }));


        /* save persistent sessions in mongo */
        this.app.use(
            session({
                secret: this.config.sessionsSecret,
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

        this.server = http.createServer(this.app);
    }

    async init() {

        const _this = this;

        /* putting schema together */
        const schema = makeExecutableSchema({
            typeDefs,
            resolvers: {
                ...resolvers,
                BigInt: scalarResolvers,
                // This maps the `Upload` scalar to the implementation provided
                // by the `graphql-upload` package.
                Upload: GraphQLUpload
            }
        });

        /* register apolloserver for graphql requests */
        const gqlServer = new ApolloServer<ApolloServerContext>({
            schema,
            csrfPrevention: false,
            allowBatchedHttpRequests: true,
            plugins: [
                {
                    async serverWillStart() {
                        logPlugin.serverWillStartLogPlugin();
                        return {
                            async drainServer() {
                                subscriptionServer.close();
                            }
                        };
                    },
                    async requestDidStart() {
                        return {
                            async executionDidStart(requestContext) {
                                const operation = requestContext.operationName;
                                const actionData = requestContext.request.variables;
                                (requestContext as any).request.variables = spaceFixing(operation as any, actionData);
                            },
                            async willSendResponse(requestContext) {
                                logPlugin.requestDidStartLogPlugin(requestContext);
                            }
                        };
                    }
                },
                ApolloServerPluginDrainHttpServer({ httpServer: this.server })
            ],
            formatError: (error) => {
                // TO_DO: generate a ref uuid for errors so the clients can contact admin
                // TO_DO: check if the error is not thrown my me manually then switch to generic error to client and log
                // Logger().error(error);
                return error;
            }
        });

        /* AE proxy middleware */
        // initial this before graphqlUploadExpress middleware
        const ae_proxy = createProxyMiddleware({
            target: _this.config.aeEndpoint,
            ws: true,
            xfwd: true,
            // logLevel: 'debug',
            autoRewrite: true,
            changeOrigin: true,
            onProxyReq: function (preq, req, res) {
                if (!req.user)
                    return res.status(403).redirect('/');
                res.cookie('ae_proxy', req.headers['host']);
                const data = (req.user as IUser).username + ':token';
                preq.setHeader('authorization', `Basic ${Buffer.from(data).toString('base64')}`);
                if (req.body && Object.keys(req.body).length) {
                    const contentType = preq.getHeader('Content-Type');
                    preq.setHeader('origin', _this.config.aeEndpoint);
                    const writeBody = (bodyData: string) => {
                        preq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                        preq.write(bodyData);
                        preq.end();
                    };

                    if (contentType === 'application/json') {  // contentType.includes('application/json')
                        writeBody(JSON.stringify(req.body));
                    }

                    if (contentType === 'application/x-www-form-urlencoded') {
                        writeBody(qs.stringify(req.body));
                    }

                }
            },
            onProxyReqWs: function (preq) {
                const data = 'username:token';
                preq.setHeader('authorization', `Basic ${Buffer.from(data).toString('base64')}`);
            },
            onError: function (err, req, res, target) {
                console.error(err, target);
            }
        });

        this.proxies.push(ae_proxy);

        /* AE routers */
        // pun for AE portal
        // node and rnode for AE application
        // public for public resource like favicon and logo
        const proxy_routers = ['/pun', '/node', '/rnode', '/public'];

        proxy_routers.forEach(router => {
            this.app.use(router, ae_proxy);
        });

        await gqlServer.start();

        this.app.use(
            '/graphql',
            express.json(),
            graphqlUploadExpress(),
            expressMiddleware(gqlServer, {
                // context: async({ req }) => ({ token: req.headers.token })
                context: async ({ req, res }) => {
                    /* Bounce all unauthenticated graphql requests */
                    // if (req.user === undefined && req.body.operationName !== 'login' && req.body.operationName !== 'IntrospectionQuery' ) {  // login and schema introspection doesn't need authentication
                    //     throw new ForbiddenError('not logged in');
                    // }
                    const token: string = req.headers.authorization || '';
                    if ((token !== '') && (req.user === undefined)) {
                        // get the decoded payload ignoring signature, no symmetric secret or asymmetric key needed
                        const decodedPayload = jwt.decode(token);
                        // obtain the public-key of the robot user in the JWT payload
                        const pubkey = (decodedPayload as any).publicKey;

                        // verify the JWT
                        jwt.verify(token, pubkey, function (error: any) {
                            if (error) {
                                throw new GraphQLError('JWT verification failed. ' + error, { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT, error } });
                            }
                        });
                        // store the associated user with the JWT to context
                        const associatedUser = await userRetrieval(pubkey);
                        req.user = associatedUser;
                    }
                    return ({ req, res });
                }
            })
        );

        /* register the graphql subscription functionalities */
        const subscriptionServer = SubscriptionServer.create({
            // This is the `schema` we just created.
            schema,
            // These are imported from `graphql`.
            execute,
            subscribe
        }, {
            // This is the `httpServer` we created in a previous step.
            server: this.server,
            // Pass a different path here if your ApolloServer serves at
            // a different path.
            path: '/graphql'
        });

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

    public getProxy(): RequestHandler {
        return this.proxies[0];
    }

    public getServer(): http.Server {
        return this.server;
    }
}

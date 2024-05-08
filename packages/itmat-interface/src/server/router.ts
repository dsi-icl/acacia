import { ApolloServer } from '@apollo/server';
import { ApolloServerErrorCode } from '@apollo/server/errors';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { GraphQLError } from 'graphql';
import { graphqlUploadExpress, GraphQLUpload } from 'graphql-upload-minimal';
import { execute, subscribe } from 'graphql';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import MongoStore from 'connect-mongo';
import express from 'express';
import { Express } from 'express';
import { Request, Response, RequestHandler as NativeRequestHandler } from 'express-serve-static-core';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import http from 'node:http';
import passport from 'passport';
import { db } from '../database/database';
import { resolvers } from '../graphql/resolvers';
import { typeDefs } from '../graphql/typeDefs';
import { fileDownloadControllerInstance } from '../rest/fileDownload';
import { BigIntResolver as scalarResolvers } from 'graphql-scalars';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import qs from 'qs';
import { IUser } from '@itmat-broker/itmat-types';
import { ApolloServerContext } from '../graphql/ApolloServerContext';
import { DMPContext } from '../graphql/resolvers/context';
import { logPluginInstance } from '../log/logPlugin';
import { IConfiguration, spaceFixing, userRetrieval } from '@itmat-broker/itmat-cores';
import { userLoginUtils } from '../utils/userLoginUtils';

export class Router {
    private readonly app: Express;
    private readonly server: http.Server;
    private readonly config: IConfiguration;
    public readonly proxies: Array<RequestHandler<Request, Response>> = [];

    constructor(config: IConfiguration) {

        this.config = config;
        this.app = express();

        this.app.use(rateLimit({
            windowMs: 1 * 60 * 1000,
            max: 500
        }));

        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true }));


        /* save persistent sessions in mongo */
        this.app.use(
            session({
                store: process.env['NODE_ENV'] === 'test' ? undefined : MongoStore.create({
                    client: db.client,
                    collectionName: config.database.collections['sessions_collection']
                }),
                secret: this.config.sessionsSecret,
                saveUninitialized: false,
                resave: false,
                rolling: true,
                cookie: {
                    maxAge: 2 * 60 * 60 * 1000 /* 2 hour */,
                    secure: 'auto'
                }
            })
        );


        /* authenticating user of the request */
        this.app.use(passport.initialize());
        this.app.use(passport.session());
        passport.serializeUser(userLoginUtils.serialiseUser);
        passport.deserializeUser(userLoginUtils.deserialiseUser);

        this.server = http.createServer({
            keepAlive: true,
            keepAliveInitialDelay: 0,
            requestTimeout: 0,
            noDelay: true
        }, this.app);

        this.server.timeout = 0;
        this.server.headersTimeout = 0;
        this.server.requestTimeout = 0;
        this.server.keepAliveTimeout = 1000 * 60 * 60 * 24 * 5;
        this.server.on('connection', (socket) => {
            socket.setKeepAlive(true);
            socket.setNoDelay(true);
            socket.setTimeout(0);
            (socket as unknown as Record<string, unknown>)['timeout'] = 0;
        });
    }

    async init() {

        // eslint-disable-next-line @typescript-eslint/no-this-alias
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
                        await logPluginInstance.serverWillStartLogPlugin();
                        return {
                            async drainServer() {
                                await serverCleanup.dispose();
                            }
                        };
                    },
                    async requestDidStart() {
                        return {
                            async executionDidStart(requestContext) {
                                const operation = requestContext.operationName;
                                const actionData = requestContext.request.variables;
                                requestContext.request.variables = operation ? spaceFixing(operation, actionData) : undefined;
                            },
                            async willSendResponse(requestContext) {
                                await logPluginInstance.requestDidStartLogPlugin(requestContext);
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
            on: {
                proxyReq: function (preq, req: Request, res: Response) {
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

                        if (contentType === 'application/json') {
                            writeBody(JSON.stringify(req.body));
                        }

                        if (contentType === 'application/x-www-form-urlencoded') {
                            writeBody(qs.stringify(req.body));
                        }

                    }
                },
                proxyReqWs: function (preq) {
                    const data = 'username:token';
                    preq.setHeader('authorization', `Basic ${Buffer.from(data).toString('base64')}`);
                },
                error: function (err, req, res, target) {
                    console.error(err, target);
                }
            }
        });

        this.proxies.push(ae_proxy);

        /* AE routers */
        // pun for AE portal
        // node and rnode for AE application
        // public for public resource like favicon and logo
        const proxy_routers = ['/pun', '/node', '/rnode', '/public'];

        proxy_routers.forEach(router => {
            this.app.use(router, ae_proxy as NativeRequestHandler);
        });

        await gqlServer.start();

        this.app.use(
            '/graphql',
            express.json(),
            graphqlUploadExpress(),
            expressMiddleware(gqlServer, {
                context: async ({ req, res }): Promise<DMPContext> => {
                    const token: string = req.headers.authorization || '';
                    if ((token !== '') && (req.user === undefined)) {
                        // get the decoded payload ignoring signature, no symmetric secret or asymmetric key needed
                        const decodedPayload = jwt.decode(token);
                        // obtain the public-key of the robot user in the JWT payload
                        let pubkey;
                        if (decodedPayload !== null && typeof decodedPayload === 'object') {
                            pubkey = decodedPayload['publicKey'];
                        } else {
                            throw new GraphQLError('JWT verification failed. ', { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT } });
                        }

                        // verify the JWT
                        jwt.verify(token, pubkey, function (error) {
                            if (error) {
                                throw new GraphQLError('JWT verification failed. ' + error, { extensions: { code: ApolloServerErrorCode.BAD_USER_INPUT, error } });
                            }
                        });
                        // store the associated user with the JWT to context
                        const associatedUser = await userRetrieval(db, pubkey);
                        req.user = associatedUser;
                    }
                    return ({ req, res });
                }
            })
        );

        /* register the graphql subscription functionalities */
        // Creating the WebSocket subscription server
        const wsServer = new WebSocketServer({
            // This is the `httpServer` returned by createServer(app);
            server: this.server,
            // Pass a different path here if your ApolloServer serves at
            // a different path.
            path: '/graphql'
        });

        // Passing in an instance of a GraphQLSchema and
        // telling the WebSocketServer to start listening
        const serverCleanup = useServer({ schema: schema, execute: execute, subscribe: subscribe }, wsServer);

        /* Bounce all unauthenticated non-graphql HTTP requests */
        // this.app.use((req: Request, res: Response, next: NextFunction) => {
        //     if (req.user === undefined || req.user.username === undefined) {
        //         res.status(401).json(new CustomError('Please log in first.'));
        //         return;
        //     }
        //     next();
        // });

        this.app.get('/file/:fileId', fileDownloadControllerInstance.fileDownloadController);

    }

    public getApp(): Express {
        return this.app;
    }

    public getProxy(): RequestHandler<Request, Response> {
        return this.proxies[0];
    }

    public getServer(): http.Server {
        return this.server;
    }
}

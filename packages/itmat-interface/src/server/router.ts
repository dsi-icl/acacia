import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { graphqlUploadExpress, GraphQLUpload } from 'graphql-upload-minimal';
import { execute, subscribe } from 'graphql';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
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
import { fileDownloadControllerInstance } from '../rest/fileDownload';
import { BigIntResolver as scalarResolvers } from 'graphql-scalars';
import 'json-bigint-patch';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { FileUploadSchema, IUserConfig, enumConfigType, enumUserTypes } from '@itmat-broker/itmat-types';
import { logPluginInstance } from '../log/logPlugin';
import { IConfiguration, spaceFixing } from '@itmat-broker/itmat-cores';
import { userLoginUtils } from '../utils/userLoginUtils';
import * as trpcExpress from '@trpc/server/adapters/express';
import { tokenAuthentication, uploadFileData } from './commonMiddleware';
import multer from 'multer';
import { Readable } from 'stream';
import { z } from 'zod';
import { ApolloServerContext, DMPContext, createtRPCContext, typeDefs } from '@itmat-broker/itmat-apis';
import { APICalls } from './helper';
import { registerContainSocketServer, registerJupyterSocketServer, jupyterProxyMiddleware, vncProxyMiddleware, registerVNCSocketServer, initializeProxyCacheCleanup } from '../lxd';
import { Socket } from 'node:net';
import { Logger } from '@itmat-broker/itmat-commons';


export class Router {
    private readonly app: Express;
    private readonly server: http.Server;
    private readonly config: IConfiguration;
    // public readonly proxies: Array<RequestHandler<Request, Response>> = [];

    constructor(config: IConfiguration) {

        this.config = config;
        this.app = express();

        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use((req, res, next) => {
            db.collections.configs_collection.findOne({
                type: enumConfigType.SYSTEMCONFIG
            })
                .then(async () => {
                    const availablePaths: string[] = (await db.collections.domains_collection.find({ 'life.deletedTime': null }).toArray()).map(el => el.domainPath);
                    // Use a regular expression to match the first path segment after the initial '/'
                    const pathMatch = req.url.match(/^\/([^/]+)/);
                    // If there's a match and it's one of the known base paths, remove it from req.url
                    if (pathMatch && availablePaths.includes(pathMatch[1])) {
                        // Remove the matched segment from req.url
                        req.url = req.url.substring(pathMatch[0].length);
                        // Handle the special case where req.url becomes empty, which should default to '/'
                        if (req.url === '') {
                            req.url = '/';
                        }
                    }
                    next();
                })
                .catch(err => {
                    next(err);
                });
        });

        this.app.set('trust proxy', 1);

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

        this.app.use(rateLimit({
            windowMs: 1 * 60 * 1000,
            max: async function (req) {
                const minimumQPS = 5000;
                let qps = minimumQPS;
                if (req.user) {
                    const userConfig = await db.collections.configs_collection.findOne({ type: enumConfigType.USERCONFIG, key: req.user.id });
                    if (!userConfig) {
                        qps = minimumQPS;
                    } else {
                        qps = (userConfig.properties as IUserConfig).defaultMaximumQPS ?? minimumQPS;
                    }
                }
                if (req.user?.type === enumUserTypes.ADMIN) {
                    qps = Math.max(qps, 2000);
                }
                return qps;
            }
        }));

        // authentication middleware
        this.app.use((req, res, next) => {
            let token: string = req.headers.authorization || '';
            if (token.startsWith('Bearer ') || token.startsWith('BEARER')) {
                token = token.slice(7);
            }
            tokenAuthentication(token)
                .then((associatedUser) => {
                    if (associatedUser) {
                        req.user = associatedUser;
                    }
                    next();
                })
                .catch(() => {
                    next();
                });
        });

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
        // const _this = this;

        const apiCalls = new APICalls();

        /* putting schema together */
        const schema = makeExecutableSchema({
            typeDefs,
            resolvers: {
                ...apiCalls._listOfGraphqlResolvers(),
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
                        const startTime = Date.now();
                        return {
                            async executionDidStart(requestContext) {
                                const operation = requestContext.operationName;
                                const actionData = requestContext.request.variables;
                                requestContext.request.variables = operation ? spaceFixing(operation, actionData) : undefined;
                            },
                            async willSendResponse(requestContext) {
                                const executionTime = Date.now() - startTime;
                                await logPluginInstance.requestDidStartLogPlugin(requestContext, startTime, executionTime);
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

        await gqlServer.start();

        this.app.use(
            '/graphql',
            express.json(),
            graphqlUploadExpress(),
            expressMiddleware(gqlServer, {
                context: async ({ req, res }): Promise<DMPContext> => {
                    return ({ req, res });
                }
            })
        );

        /* register the graphql subscription functionalities */
        const graphqlWsServer = new WebSocketServer({
            noServer: true // We'll handle upgrades manually
        });


        // Passing in an instance of a GraphQLSchema and
        // telling the WebSocketServer to start listening
        const serverCleanup = useServer({ schema: schema, execute: execute, subscribe: subscribe }, graphqlWsServer);

        /* Bounce all unauthenticated non-graphql HTTP requests */
        // this.app.use((req: Request, res: Response, next: NextFunction) => {
        //     if (req.user === undefined || req.user.username === undefined) {
        //         res.status(401).json(new CustomError('Please log in first.'));
        //         return;
        //     }
        //     next();
        // });

        // webdav

        const webdav_target = `http://localhost:${this.config.webdavPort}`;
        const webdav_proxy = createProxyMiddleware({
            target: webdav_target,
            ws: true,
            xfwd: true,
            autoRewrite: true,
            changeOrigin: true,
            pathRewrite: (path) => {
                const rewrittenPath = path.replace(/^\/webdav/, '/');
                return rewrittenPath;
            },
            on: {
                //TODO local test,  Change 'ProxyReq' to 'proxyReq' to match the correct event name
                proxyReq: function (preq, req: Request, res: Response) {

                    preq.setHeader('Host', req.headers['host'] || 'localhost');
                    preq.setHeader('Origin', req.headers['origin'] || webdav_target);
                    preq.setHeader('Accept', '*/*');
                    preq.setHeader('Connection', 'keep-alive');
                    preq.setHeader('Keep-Alive', 'timeout=120');


                    // Handle authentication
                    if (req.user) {
                        // If user info is available, create Basic auth header
                        const data = `${req.user.id}:token`;
                        preq.setHeader('Authorization', `Basic ${Buffer.from(data).toString('base64')}`);
                    } else {
                        Logger.log('Unauthorized request, webdav_proxy redirecting...');
                        res.status(403).redirect('/');
                        return;
                    }
                    // Special handling for OPTIONS request
                    if (req.method === 'OPTIONS') {
                        preq.setHeader('MS-Author-Via', 'DAV');
                        res.setHeader('DAV', '1,2');
                        res.setHeader('Allow', 'OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
                    }
                },
                proxyRes: function (proxyRes) {

                    if (proxyRes.statusCode === 500) {
                        console.error('WebDAV Server Error:', proxyRes.statusMessage);
                        let body = '';
                        proxyRes.on('data', chunk => {
                            body += chunk.toString();
                        });
                        proxyRes.on('end', () => {
                            Logger.error(`Response Body: ${JSON.stringify(body)}`);
                        });
                    }
                }
            }
        });

        this.app.use('/webdav', webdav_proxy as NativeRequestHandler);

        this.app.use('/trpc/data.uploadStudyFileData', (req, res, next) => {
            uploadFileData(req, res).catch(next); // Ensure any error is passed to next()
        });

        // trpc
        const upload = multer();
        this.app.use(
            '/trpc',
            upload.any(), // Accept any field name for file uploads
            (req, _res, next) => {
                (async () => {
                    try {
                        if (req.files && req.files.length > 0) {
                            const files = req.files || [];
                            const transformedFiles: Record<string, z.infer<typeof FileUploadSchema>[]> = {};

                            for (const file of files) {
                                if (!transformedFiles[file.fieldname]) {
                                    transformedFiles[file.fieldname] = [];
                                }

                                transformedFiles[file.fieldname].push({
                                    createReadStream: () => {
                                        const readableStream = new Readable();
                                        // eslint-disable-next-line @typescript-eslint/no-empty-function
                                        readableStream._read = () => { }; // No-op _read method
                                        readableStream.push(file.buffer);
                                        readableStream.push(null); // Signify the end of the stream
                                        return readableStream;
                                    },
                                    filename: file.originalname,
                                    mimetype: file.mimetype,
                                    encoding: file.encoding,
                                    fieldName: file.fieldname
                                });
                            }
                            req.body.files = transformedFiles; // Attach the transformed files to the request body for later use
                        }
                        next();
                    } catch (error) {
                        next(error);
                    }
                })().catch(next);
            }, trpcExpress.createExpressMiddleware({
                router: apiCalls._listOfTRPCRouters(),
                createContext: createtRPCContext
            }));

        this.app.get('/file/:fileId', fileDownloadControllerInstance.fileDownloadController);


        // set up the proxy and register directly, combine the grapgql's websocket and lxd's websocket

        // Setup HTTP route handlers for Jupyter proxy requests
        const proxyRoutes = ['/jupyter/:instance_id', '/jupyter/:instance_id/*'];
        proxyRoutes.forEach((route) => {
            this.app.use(route, (req, res, next) => {
                jupyterProxyMiddleware(req, res, next, apiCalls.instanceCore).catch(next);
            });
        });

        // Add VNC proxy routes
        const vncProxyRoutes = ['/matlab/:instance_id', '/matlab/:instance_id/*'];
        vncProxyRoutes.forEach((route) => {
            this.app.use(route, (req, res, next) => {
                vncProxyMiddleware(req, res, next, apiCalls.instanceCore).catch(next);
            });
        });


        // Create WebSocket server for RTC connections
        const containerWsServer = new WebSocketServer({
            noServer: true
        });

        registerContainSocketServer(containerWsServer, apiCalls.lxdManager);

        // Create WebSocket server for  connections
        const targetWsServer = new WebSocketServer({
            noServer: true
        });

        registerJupyterSocketServer(targetWsServer, apiCalls.instanceCore);

        // Create WebSocket server for VNC connections
        const vncWsServer = new WebSocketServer({
            noServer: true
        });

        registerVNCSocketServer(vncWsServer, apiCalls.instanceCore);

        // Upgrade handler for WebSocket requests
        this.server.on('upgrade', (req, socket: Socket, head: Buffer) => {

            if (req.url?.startsWith('/graphql')) {
                // Handle GraphQL WebSocket connection for subscriptions
                graphqlWsServer.handleUpgrade(req, socket, head, (ws) => {
                    graphqlWsServer.emit('connection', ws, req); // Forward the upgrade to the GraphQL WebSocket server
                });
            } else if (req.url?.startsWith('/jupyter')) {
                const instance_id = req.url.split('/')[2];  // Extract instance ID from the URL

                if (!instance_id) {
                    Logger.error('No instance ID found in URL.');
                    socket.end();
                    return;
                }
                try {
                    targetWsServer.handleUpgrade(req, socket, head, (ws) => {

                        targetWsServer.emit('connection', ws, req);  // Forward the upgrade to the container WebSocket server
                    }
                    );
                } catch (error) {
                    Logger.log(`error ${JSON.stringify(error)}`);
                    socket.end();  // End socket if there's an error creating the proxy
                    return;
                }
            }
            // handle VNC websocket connections
            else if (req.url?.startsWith('/matlab')) {

                if (req.headers.upgrade?.toLowerCase() === 'websocket') {

                    vncWsServer.handleUpgrade(req, socket, head, (ws) => {
                        vncWsServer.emit('connection', ws, req);
                    });
                } else {
                    socket.destroy();
                }
            }
            // Handle RTC WebSocket connections
            else if (req.url?.startsWith('/rtc')) {

                containerWsServer.handleUpgrade(req, socket, head, (ws) => {
                    containerWsServer.emit('connection', ws, req);  // Forward the upgrade to the container WebSocket server
                });
            }
            // Invalid WebSocket request
            else {
                Logger.error(`Invalid WebSocket upgrade request: ${req.url}`);
                socket.destroy();  // Close socket if the request is not valid
            }
        });

        // Initialize the proxy cache cleanup system
        initializeProxyCacheCleanup();

    }

    public getApp(): Express {
        return this.app;
    }

    // public getProxy(): RequestHandler<Request, Response> {
    //     return this.proxies[0];
    // }

    public getServer(): http.Server {
        return this.server;
    }

}

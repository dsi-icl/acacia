// eslint:disable: no-console
import { Express } from 'express';
import { Socket } from 'net';
import http from 'http';
import ITMATJobExecutorServer from './jobExecutorServer';
import config from './utils/configManager';

let interfaceServer = new ITMATJobExecutorServer(config);
let interfaceSockets: Socket[] = [];
let interfaceSocket: http.Server;
let interfaceRouter: Express;

function serverStart() {
    console.info(`Starting executor server ${process.pid} ...`);
    interfaceServer.start().then((itmatRouter) => {

        interfaceRouter = itmatRouter.getApp();
        interfaceSocket = interfaceRouter.listen(config.server.port, () => {
            console.info(`Listening at http://localhost:${config.server.port}/`);
        })
            .on('connection', (socket) => {
                interfaceSockets.push(socket);
            })
            .on('error', (error) => {
                if (error) {
                    console.error('An error occurred while starting the HTTP server.', error);
                    return;
                }
            });

    }).catch((error) => {
        console.error('An error occurred while starting the ITMAT job executor.', error);
        if (error.stack)
            console.error(error.stack);
        return false;
    });
}

function serverSpinning() {

    if (interfaceRouter !== undefined) {
        console.info('Renewing executor server ...');
        interfaceServer = new ITMATJobExecutorServer(config);
        console.info(`Destroying ${interfaceSockets.length} sockets ...`);
        interfaceSockets.forEach((socket) => {
            socket.destroy();
        });
        interfaceSockets = [];
        interfaceSocket.close(() => {
            console.info(`Shuting down executor server ${process.pid} ...`);
            interfaceRouter?.on('close', () => {
                serverStart();
            }) || serverStart();
        });
    } else {
        serverStart();
    }
}

serverSpinning();

declare const module: any;
if (module.hot) {
    module.hot.accept('./index', serverSpinning);
    module.hot.accept('./jobExecutorServer', serverSpinning);
    module.hot.accept('./index.ts', serverSpinning);
    module.hot.accept('./jobExecutorServer.ts', serverSpinning);
}

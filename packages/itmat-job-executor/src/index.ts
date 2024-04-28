// eslint:disable: no-console
import { Express } from 'express';
import { Socket } from 'net';
import http from 'http';
import ITMATJobExecutorRunner from './jobExecutorRunner';
import config from './utils/configManager';

let interfaceRunner = new ITMATJobExecutorRunner(config);
let interfaceSockets: Socket[] = [];
let interfaceServer: http.Server;
let interfaceRouter: Express;

function serverStart() {
    console.info(`Starting executor server ${process.pid} ...`);
    interfaceRunner.start().then((itmatRouter) => {

        interfaceRouter = itmatRouter.getApp();
        interfaceServer = interfaceRouter.listen(config.server.port, () => {
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
        setTimeout(serverStart, 5000);
        return false;
    });
}

function serverSpinning() {

    if (interfaceRouter !== undefined) {
        console.info('Renewing executor server ...');
        interfaceRunner = new ITMATJobExecutorRunner(config);
        console.info(`Destroying ${interfaceSockets.length} sockets ...`);
        interfaceSockets.forEach((socket) => {
            socket.destroy();
        });
        interfaceSockets = [];
        interfaceServer.close(() => {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const module: any;
if (module.hot) {
    module.hot.accept('./index', serverSpinning);
    module.hot.accept('./jobExecutorRunner', serverSpinning);
    module.hot.accept('./index.ts', serverSpinning);
    module.hot.accept('./jobExecutorRunner.ts', serverSpinning);
}

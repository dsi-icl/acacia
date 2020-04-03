
// eslint:disable: no-console
import { Server } from 'http';
import { Socket } from 'net';
import os from 'os';
import { Logger } from '@itmat/utils';
import ITMATInterfaceServer from './interfaceServer';
import config from './utils/configManager';

let interfaceIteration = 0;
let interfaceStarting = false;
let interfaceSockets: Socket[] = [];
let interfaceServer;
let interfaceRouter;

function serverStart() {
    if (interfaceStarting) return;
    console.info(`Starting server ${interfaceIteration++} ...`);
    interfaceStarting = true;
    interfaceServer = new ITMATInterfaceServer(config);
    interfaceServer.start().then((itmatRouter: Server) => {
        interfaceRouter = itmatRouter;
        interfaceRouter.listen(config.server.port, () => {
            console.info(`Listening at http://${os.hostname()}:${config.server.port}/`);
            interfaceStarting = false;
        })
            .on('connection', (socket) => {
                interfaceSockets.push(socket);
            })
            .on('error', (error) => {
                if (error) {
                    Logger.error('An error occurred while starting the HTTP server.', error);
                }
            });
    }).catch((error) => {
        Logger.error('An error occurred while starting the ITMAT core.', error);
        Logger.error(error.stack);
        return false;
    });
}

function serverSpinning() {
    if (interfaceRouter !== undefined) {
        console.info('Renewing server ...');
        console.info(`Destroying ${interfaceSockets.length} sockets ...`);
        interfaceSockets.forEach((socket) => {
            socket.destroy();
        });
        interfaceSockets = [];
        console.info(`Shuting down server ${interfaceIteration} ...`);
        interfaceRouter.close(() => {
            serverStart();
        });
    } else {
        serverStart();
    }
}

serverSpinning();

if (module.hot) {
    module.hot.accept('./index.ts', serverSpinning);
    module.hot.accept('./interfaceServer.ts', serverSpinning);
}

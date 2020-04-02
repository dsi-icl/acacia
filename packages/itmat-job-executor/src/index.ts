
// eslint:disable: no-console
import { Server } from 'http';
import { Socket } from 'net';
import os from 'os';
import ITMATJobExecutorServer from './jobExecutorServer';
import config from './utils/configManager';

let interfaceIteration = 0;
let interfaceStarting = false;
let interfaceSockets: Socket[] = [];
let interfaceServer;
let interfaceRouter;

function serverStart() {
    if (interfaceStarting)
        return;
    console.info(`Starting server ${interfaceIteration++} ...`);
    interfaceStarting = true;
    interfaceServer = new ITMATJobExecutorServer(config);
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
                    console.error('An error occurred while starting the HTTP server.', error);
                    return;
                }
            });

    }).catch((error) => {
        console.error('An error occurred while starting the ITMAT job executor.', error);
        console.error(error.stack);
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
    module.hot.accept('./jobExecutorServer.ts', serverSpinning);
}

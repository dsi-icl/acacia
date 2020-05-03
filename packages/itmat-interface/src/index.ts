
// eslint:disable: no-console
import { Server } from 'http';
import { Socket } from 'net';
import os from 'os';
import ITMATInterfaceServer from './interfaceServer';
import config from './utils/configManager';

let interfaceIteration = 0;
let interfaceServer = new ITMATInterfaceServer(config);
let interfaceSockets: Socket[] = [];
let interfaceRouter;

function serverStart() {
    console.info(`Starting server ${interfaceIteration++} ...`);
    interfaceServer.start().then((itmatRouter: Server) => {

        interfaceRouter = itmatRouter;
        itmatRouter.listen(config.server.port, () => {
            console.info(`Listening at http://${os.hostname()}:${config.server.port}/`);
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
        console.error('An error occurred while starting the ITMAT core.', error);
        console.error(error.stack);
        return false;
    });
}

function serverSpinning() {

    if (interfaceRouter !== undefined) {
        console.info('Renewing server ...');
        interfaceServer = new ITMATInterfaceServer(config);
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
    module.hot.accept('./index', serverSpinning);
    module.hot.accept('./interfaceServer', serverSpinning);
}

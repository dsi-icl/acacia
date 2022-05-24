// eslint:disable: no-console
import { Socket } from 'net';
import os from 'os';
import http from 'http';
import ITMATInterfaceServer from './interfaceServer';
import config from './utils/configManager';

let interfaceIteration = 0;
let interfaceServer = new ITMATInterfaceServer(config);
let interfaceSockets: Socket[] = [];
let interfaceSocket: http.Server;
let interfaceRouter;
let interfaceRouterProxy;

function serverStart() {
    console.info(`Starting server ${interfaceIteration++} ...`);
    interfaceServer.start().then((itmatRouter) => {

        interfaceRouter = itmatRouter.getApp();
        interfaceRouterProxy = itmatRouter.getProxy();
        interfaceSocket = interfaceRouter.listen(config.server.port, () => {
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
            })
            .on('upgrade', interfaceRouterProxy.upgrade);

    }).catch((error) => {
        console.error('An error occurred while starting the ITMAT core.', error);
        if (error.stack)
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
        interfaceSocket.close(() => {
            console.info(`Shuting down server ${interfaceIteration} ...`);
            interfaceRouter?.close?.(() => {
                serverStart();
            }) || serverStart();
        });
    } else {
        serverStart();
    }
}

serverSpinning();

if (module.hot) {
    module.hot.accept('./index', serverSpinning);
    module.hot.accept('./interfaceServer', serverSpinning);
    module.hot.accept('./index.ts', serverSpinning);
    module.hot.accept('./interfaceServer.ts', serverSpinning);
}

import { Server } from 'http';
import { Socket } from 'net';
import os from 'os';
import ITMATInterfaceServer from './interfaceServer';
import config from './utils/configManager';

let interface_iteration = 0;
let interface_server = new ITMATInterfaceServer(config);
let interface_sockets: Socket[] = [];
let interface_router;

function serverStart() {
    console.log(`Starting server ${interface_iteration++} ...`);
    interface_server.start().then((itmat_router: Server) => {

        interface_router = itmat_router;
        itmat_router.listen(config.server.port, () => {
            console.log(`Listening at http://${os.hostname()}:${config.server.port}/`);
        })
            .on('connection', (socket) => {
                interface_sockets.push(socket);
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

    if (interface_router !== undefined) {
        console.log('Renewing server ...');
        interface_server = new ITMATInterfaceServer(config);
        console.log(`Destroying ${interface_sockets.length} sockets ...`);
        interface_sockets.forEach((socket) => {
            socket.destroy();
        });
        interface_sockets = [];
        console.log(`Shuting down server ${interface_iteration} ...`);
        interface_router.close(() => {
            serverStart();
        });
    } else {
        serverStart();
    }
}

serverSpinning();

if (module.hot) {
    module.hot.accept('./interfaceServer', serverSpinning);
}

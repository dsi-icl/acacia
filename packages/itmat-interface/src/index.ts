import http from 'http';
import express from 'express';
import os from 'os';
import config from './utils/configManager';
import ITMATInterfaceServer from './interfaceServer';
import { Server } from 'http';

let interface_server = new ITMATInterfaceServer(config);
let interface_router;

interface_server.start().then((itmat_router: Server) => {

    interface_router = itmat_router;
    itmat_router.listen(config.server.port, () => {
        console.log(`Listening at http://${os.hostname()}:${config.server.port}/`);
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

if (module.hot) {
    module.hot.accept('./interfaceServer', () => {
        console.log('Renewing server ...');
        interface_router.close(() => {
            console.log('Previous listener successfully closed.');

            interface_server = new ITMATInterfaceServer(config);
            interface_server.start().then((itmat_router: Server) => {

                interface_router = itmat_router;
                itmat_router.listen(config.server.port, () => {
                    console.log(`Listening at http://${os.hostname()}:${config.server.port}/`);
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
        })
    });
}

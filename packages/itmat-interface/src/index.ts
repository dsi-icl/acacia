// eslint:disable: no-console
import { Express } from 'express';
import { Socket } from 'net';
import http from 'http';
import ITMATInterfaceRunner from './interfaceRunner';
import config from './utils/configManager';
import { db } from './database/database';
import { IUser, enumUserTypes } from '@itmat-broker/itmat-types';
import { mailer } from './emailer/emailer';

let interfaceRunner = new ITMATInterfaceRunner(config);
let interfaceSockets: Socket[] = [];
let interfaceServer: http.Server;
let interfaceRouter: Express;

function serverStart() {
    console.info(`Starting api server ${process.pid} ...`);
    interfaceRunner.start().then(async (itmatRouter) => {

        interfaceServer = itmatRouter.getServer();
        interfaceServer.timeout = 0;
        interfaceServer.headersTimeout = 0;
        interfaceServer.requestTimeout = 0;
        interfaceServer.keepAliveTimeout = 1000 * 60 * 60 * 24 * 5;
        interfaceServer.listen(config.server.port, () => {
            console.info(`Listening at http://localhost:${config.server.port}/`);
        })
            .on('connection', (socket) => {
                socket.setKeepAlive(true);
                socket.setNoDelay(true);
                socket.setTimeout(0);
                (socket as unknown as Record<string, unknown>)['timeout'] = 0;
                interfaceSockets.push(socket);
            })
            .on('error', (error) => {
                if (error) {
                    console.error('An error occurred while starting the HTTP server.', error);
                    return;
                }
            });

        // notice users of expiration
        await emailNotification();

        // const interfaceRouterProxy = itmatRouter.getProxy();
        // if (interfaceRouterProxy?.upgrade)
        //     interfaceServer.on('upgrade', interfaceRouterProxy?.upgrade);

    }).catch((error) => {
        console.error('An error occurred while starting the ITMAT core.', error);
        if (error.stack)
            console.error(error.stack);
        setTimeout(serverStart, 5000);
        return false;
    });
}

function serverSpinning() {

    if (interfaceRouter !== undefined) {
        console.info('Renewing api server ...');
        interfaceRunner = new ITMATInterfaceRunner(config);
        console.info(`Destroying ${interfaceSockets.length} sockets ...`);
        interfaceSockets.forEach((socket) => {
            socket.destroy();
        });
        interfaceSockets = [];
        interfaceServer.close(() => {
            console.info(`Shuting down api server ${process.pid} ...`);
            interfaceRouter?.on('close', () => {
                serverStart();
            });
            serverStart();
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
    module.hot.accept('./interfaceRunner', serverSpinning);
    module.hot.accept('./index.ts', serverSpinning);
    module.hot.accept('./interfaceRunner.ts', serverSpinning);
}

async function emailNotification() {
    const now = Date.now().valueOf();
    const threshold = now + 7 * 24 * 60 * 60 * 1000;
    const users = await db.collections.users_collection.find<IUser>({
        'expiredAt': {
            $lte: threshold,
            $gt: now
        },
        'type': { $ne: enumUserTypes.ADMIN },
        'emailNotificationsActivated': true,
        'emailNotificationsStatus.expiringNotification': false,
        'life.deletedTime': null
    }).toArray();
    for (const user of users) {
        await mailer.sendMail({
            from: `${config.appName} <${config.nodemailer.auth.user}>`,
            to: user.email,
            subject: `[${config.appName}] Account is going to expire!`,
            html: `
                <p>
                    Dear ${user.firstname},
                <p>
                <p>
                    Your account will expire at ${new Date(user.expiredAt).toDateString()}.
                    You can make a request on the login page at ${config.appName}.
                </p>

                <br/>
                <p>
                    The ${config.appName} Team.
                </p>
            `
        });
        await db.collections.users_collection.findOneAndUpdate({ id: user.id }, {
            $set: { emailNotificationsStatus: { expiringNotification: true } }
        });
    }
    setInterval(() => { emailNotification().catch(() => { return; }); }, 24 * 60 * 60 * 1000);
}

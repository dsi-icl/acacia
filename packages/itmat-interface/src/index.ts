import { Server } from './server/server';
import { Router } from './server/router';
import { db } from './database/database';
import config from './utils/configManager';
import { objStore } from './objStore/objStore';

const server = new Server(config);

db.connect(config.database)
    .then(() => objStore.connect())
    .then(() => {
        const router = new Router(db);
        server.start(router.getApp());
    })
    .catch((e) => {
        console.error('Could not start interface server:', e.message)
        process.exit(1);
    });


if (module.hot) {
    module.hot.accept('.', () => {
        console.log('Reloading...');
    });
}

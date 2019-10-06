import { db } from './database/database';
import { objStore } from './objStore/objStore';
import { Router } from './server/router';
import { Server } from './server/server';
import config from './utils/configManager';

const server = new Server(config);

db.connect(config.database)
    .then(() => objStore.connect())
    .then(() => {
        const router = new Router(db);
        server.start(router.getApp());
    })
    .catch((e) => {
        console.error('Could not start interface server:', e.message);
        process.exit(1);
    });

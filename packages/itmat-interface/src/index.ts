import { Server } from './server/server';
import { Router } from './server/router';
import { db } from './database/database';
import { OpenStackSwiftObjectStore } from 'itmat-utils';
import config from '../config/config.json';
import { Query } from 'itmat-utils/dist/models';
import { objStore } from './objStore/objStore';

const server = new Server(config);

db.connect(config.database)
    .then(() => objStore.connect())
    .then(() => {
        const router = new Router(db);
        server.start(router.getApp());
});
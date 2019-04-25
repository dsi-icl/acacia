import { Server } from './server/server';
import { Router } from './server/router';
import { db } from './database/database';
import { JobPoller } from 'itmat-utils';
import { queryHandler } from './query/queryHandler';
import config from '../config/config.json';
import { objStore } from './objStore/objStore';

const server = new Server(config);

db.connect(config.database)
    .then(() => objStore.connect())
    .then(() => {
        const router = new Router();
        server.start(router.getApp());
        const poller = new JobPoller('me', 'QUERY', db.collections!.queries_collection, config.pollingInterval, queryHandler.actOnDocument);
        poller.setInterval();
        return;
});
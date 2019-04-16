import { Server } from './server/server';
import { Router } from './server/router';
import { db } from './database/database';
import config from '../config/config.json';
import { Poller } from 'itmat-utils';
import { queryHandler } from './query/queryHandler';

const server = new Server(config);

db.connect(config.database)
    .then(() => {
        const router = new Router();
        server.start(router.getApp());
        const poller = new Poller('me', 'QUERY', db.collections!.queries_collection, config.pollingInterval, queryHandler.actOnDocument);
        poller.setInterval();
        return;
});
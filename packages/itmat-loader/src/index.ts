import { Server } from './server/server';
import { Router } from './server/router';
import { db } from './database/database';
import config from '../config/config.json';
import { OpenStackSwiftObjectStore } from 'itmat-utils';
import { JobPoller } from 'itmat-utils';
import { JobDispatcher } from './jobDispatch/dispatcher';

const server = new Server(config);
const objStore = new OpenStackSwiftObjectStore(config.swift);

db.connect(config.database)
    .then(() => objStore.connect())
    .then(() => {
        const router = new Router();
        server.start(router.getApp());
        const poller = new JobPoller('me', 'UKB_FIELD_INFO_UPLOAD', db.collections!.jobs_collection, config.pollingInterval, new JobDispatcher(db, objStore).dispatch);
        poller.setInterval();
        return;
});
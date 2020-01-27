import { JobPoller } from 'itmat-utils';
import { db } from './database/database';
import { JobDispatcher } from './jobDispatch/dispatcher';
import { objStore } from './objStore/objStore';
import { Router } from './server/router';
import { Server } from './server/server';
import config from './utils/configManager';

/* TO_DO: can we figure out the files at runtime and import at runtime */
import { UKBCSVUploadHandler } from './jobHandlers/UKBCSVUploadHandler';
import { UKBFieldInfoUploadHandler } from './jobHandlers/UKBFieldInfoUploadHandler';
import { UKBImageUploadHandler } from './jobHandlers/UKBImageUploadHandler';

const server = new Server(config);

db.connect(config.database)
    .then(() => objStore.connect())
    .then(() => {
        const router = new Router();
        const jobDispatcher = new JobDispatcher();

        /* TO_DO: can we figure out the files at runtime and import at runtime */
        jobDispatcher.registerJobType('UKB_CSV_UPLOAD', UKBCSVUploadHandler.prototype.getInstance);
        jobDispatcher.registerJobType('UKB_FIELD_INFO_UPLOAD', UKBFieldInfoUploadHandler.prototype.getInstance);
        jobDispatcher.registerJobType('UKB_IMAGE_UPLOAD', UKBImageUploadHandler.prototype.getInstance);

        server.start(router.getApp());
        const poller = new JobPoller('me', undefined, db.collections!.jobs_collection, config.pollingInterval, jobDispatcher.dispatch);
        poller.setInterval();
        return;
    })
    .catch((e) => {
        console.error('Could not start executor:', e.message);
        process.exit(1);
    });

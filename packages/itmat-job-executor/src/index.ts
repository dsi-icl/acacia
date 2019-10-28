import { JobPoller } from 'itmat-utils';
import { db } from './database/database';
import { JobDispatcher } from './jobDispatch/dispatcher';
import { objStore } from './objStore/objStore';
import { Router } from './server/router';
import { Server } from './server/server';
import config from './utils/configManager';

/* TO_DO: can we figure out the files at runtime and import at runtime */
import { UKB_CSV_UPLOAD_Handler } from './jobHandlers/UKB_CSV_UPLOAD_handler';
import { UKB_FIELD_INFO_UPLOAD_Handler } from './jobHandlers/UKB_FIELD_INFO_UPLOAD_handler';
import { UKB_IMAGE_UPLOAD_Handler } from './jobHandlers/UKB_IMAGE_UPLOAD_handler';

const server = new Server(config);

db.connect(config.database)
    .then(() => objStore.connect())
    .then(() => {
        const router = new Router();
        const jobDispatcher = new JobDispatcher();

        /* TO_DO: can we figure out the files at runtime and import at runtime */
        jobDispatcher.registerJobType('UKB_CSV_UPLOAD', UKB_CSV_UPLOAD_Handler.prototype.getInstance);
        jobDispatcher.registerJobType('UKB_FIELD_INFO_UPLOAD', UKB_FIELD_INFO_UPLOAD_Handler.prototype.getInstance);
        jobDispatcher.registerJobType('UKB_IMAGE_UPLOAD', UKB_IMAGE_UPLOAD_Handler.prototype.getInstance);

        server.start(router.getApp());
        const poller = new JobPoller('me', undefined, db.collections!.jobs_collection, config.pollingInterval, jobDispatcher.dispatch);
        poller.setInterval();
        return;
    })
    .catch((e) => {
        console.error('Could not start executor:', e.message);
        process.exit(1);
    });

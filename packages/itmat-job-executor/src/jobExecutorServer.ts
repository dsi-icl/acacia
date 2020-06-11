// External node module imports
import { Server as HTTPServer } from 'http';
import { db } from './database/database';
import { objStore } from './objStore/objStore';
import { Router } from './server/router';
import { Server } from './server/server';
import { JobPoller } from 'itmat-commons';
import { JobDispatcher } from './jobDispatch/dispatcher';
import { MongoClient } from 'mongodb';
import { UKB_CSV_UPLOAD_Handler } from './jobHandlers/UKB_CSV_UPLOAD_handler';
import { UKB_JSON_UPLOAD_Handler } from './jobHandlers/UKB_JSON_UPLOAD_handler';
import { UKB_FIELD_INFO_UPLOAD_Handler } from './jobHandlers/UKB_FIELD_INFO_UPLOAD_handler';

class ITMATJobExecutorServer extends Server {

    private router;

    /**
     * @fn start
     * @desc Start the ITMATServer service, routes are setup and
     * automatic status update is triggered.
     * @return {Promise} Resolve to a native Express.js router ready to use on success.
     * In case of error, an ErrorStack is rejected.
     */
    public start(): Promise<HTTPServer> {
        const _this = this;
        return new Promise((resolve, reject) => {

            // Operate database migration if necessary
            db.connect(this.config.database, MongoClient.connect as any)
                .then(() => objStore.connect(this.config.objectStore))
                .then(() => {

                    _this.router = new Router();

                    const jobDispatcher = new JobDispatcher();

                    /* TO_DO: can we figure out the files at runtime and import at runtime */
                    jobDispatcher.registerJobType('DATA_UPLOAD_CSV', UKB_CSV_UPLOAD_Handler.prototype.getInstance.bind(UKB_CSV_UPLOAD_Handler));
                    jobDispatcher.registerJobType('DATA_UPLOAD_JSON', UKB_JSON_UPLOAD_Handler.prototype.getInstance.bind(UKB_JSON_UPLOAD_Handler));
                    jobDispatcher.registerJobType('FIELD_INFO_UPLOAD', UKB_FIELD_INFO_UPLOAD_Handler.prototype.getInstance.bind(UKB_FIELD_INFO_UPLOAD_Handler));
                    // jobDispatcher.registerJobType('UKB_IMAGE_UPLOAD', UKB_IMAGE_UPLOAD_Handler.prototype.getInstance);

                    const poller = new JobPoller({
                        identity: 'me',
                        jobCollection: db.collections!.jobs_collection,
                        pollingInterval: this.config.pollingInterval,
                        action: jobDispatcher.dispatch
                    });
                    poller.setInterval();

                    // Return the Express application
                    return resolve(_this.router.getApp());

                }).catch((err) => reject(err));
        });
    }

    /**
     * @fn stop
     * @desc Stops the ITMAT server service. After a call to stop, all references on the
     * express router MUST be released and this service endpoints are expected to fail.
     * @return {Promise} Resolve to true on success, ErrorStack otherwise
     */
    public stop(): Promise<void> {
        return Promise.resolve();
    }
}

export default ITMATJobExecutorServer;

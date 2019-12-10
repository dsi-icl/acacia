// External node module imports
import { Server as HTTPServer } from 'http';
import { db } from './database/database';
import { objStore } from './objStore/objStore';
import { Router } from './server/router';
import { Server } from './server/server';
import { pubsub, subscriptionEvents } from './graphql/pubsub';

class ITMATInterfaceServer extends Server {

    private router;

    constructor(config) {
        super(config);
    }

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
            db.connect(this.config.database)
                .then(() => objStore.connect())
                .then(() => {

                    const jobChangestream = db.collections!.jobs_collection.watch([
                        { $match: { operationType: { $in: ['update', 'insert'] } } }
                    ], { fullDocument: 'updateLookup' });
                    jobChangestream.on('change', data => {
                        if (data.operationType === 'update' &&
                            data.updateDescription &&
                            data.updateDescription.updatedFields &&
                            data.updateDescription.updatedFields.status
                        ) {
                            pubsub.publish(subscriptionEvents.JOB_STATUS_CHANGE, { subscribeToJobStatusChange: {
                                jobId: data.fullDocument.id,
                                newStatus: data.fullDocument.status,
                                errors: data.fullDocument.status === 'error' ? data.fullDocument.errors : null
                            } });
                        }
                    });

                    _this.router = new Router();

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
    public stop() {
        return Promise.resolve();
    }
}

export default ITMATInterfaceServer;

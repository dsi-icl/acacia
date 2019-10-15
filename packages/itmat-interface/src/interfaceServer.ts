//External node module imports
import { Router } from './server/router';
import { objStore } from './objStore/objStore';
import { db } from './database/database';
import { Server } from './server/server';
import { Server as HTTPServer } from 'http';

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
    start(): Promise<HTTPServer> {
        let _this = this;
        return new Promise((resolve, reject) => {

            // Operate database migration if necessary
            db.connect(this.config.database)
                .then(() => objStore.connect())
                .then(() => {

                    _this.router = new Router();

                    // Return the Express application
                    return resolve(_this.router.getApp());

                }).catch(err => reject(err));
        });
    }

    /**
     * @fn stop
     * @desc Stops the ITMAT server service. After a call to stop, all references on the
     * express router MUST be released and this service endpoints are expected to fail.
     * @return {Promise} Resolve to true on success, ErrorStack otherwise
     */
    stop() {
        return Promise.resolve();
    }
}

export default ITMATInterfaceServer;
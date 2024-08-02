// External node module imports
import { db } from './database/database';
import { objStore } from './objStore/objStore';
import { MongoClient } from 'mongodb';
import { Router } from './server/router';
import { Runner } from './server/server';
import { dmpWebDav } from './webdav/webdav';

class ITMATInterfaceRunner extends Runner {

    private router?: Router;

    /**
     * @fn start
     * @desc Start the ITMATServer service, routes are setup and
     * automatic status update is triggered.
     * @return {Promise} Resolve to a native Express.js router ready to use on success.
     * In case of error, an ErrorStack is rejected.
     */
    public async start(): Promise<Router> {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const _this = this;
        return new Promise((resolve, reject) => {

            // Operate database migration if necessary
            db.connect(this.config.database, MongoClient)
                .then(async () => objStore.connect(this.config.objectStore))
                .then(async () => this.config?.useWebdav && dmpWebDav.connect(this.config))
                .then(async () => {
                    _this.router = new Router(this.config);
                    await _this.router.init();

                    // Return the Express application
                    return resolve(_this.router);

                }).catch((err) => reject(err));
        });
    }

    /**
     * @fn stop
     * @desc Stops the ITMAT server service. After a call to stop, all references on the
     * express router MUST be released and this service endpoints are expected to fail.
     * @return {Promise} Resolve to true on success, ErrorStack otherwise
     */
    public async stop(): Promise<void> {
        await objStore.disconnect();
        await db.closeConnection();
        return Promise.resolve();
    }
}

export default ITMATInterfaceRunner;

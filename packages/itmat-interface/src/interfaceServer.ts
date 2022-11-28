// External node module imports
import { db } from './database/database';
import { objStore } from './objStore/objStore';
import { MongoClient } from 'mongodb';
import { Router } from './server/router';
import { Server } from './server/server';
import { pubsub, subscriptionEvents } from './graphql/pubsub';
import { mailer } from './emailer/emailer';
import { IUser, userTypes } from '@itmat-broker/itmat-types';
import config from './utils/configManager';
class ITMATInterfaceServer extends Server {

    private router?: Router;

    /**
     * @fn start
     * @desc Start the ITMATServer service, routes are setup and
     * automatic status update is triggered.
     * @return {Promise} Resolve to a native Express.js router ready to use on success.
     * In case of error, an ErrorStack is rejected.
     */
    public start(): Promise<Router> {
        const _this = this;
        return new Promise((resolve, reject) => {

            // Operate database migration if necessary
            db.connect(this.config.database, MongoClient.connect as any)
                .then(() => objStore.connect(this.config.objectStore))
                .then(async () => {

                    const jobChangestream = db.collections!.jobs_collection.watch([
                        { $match: { operationType: { $in: ['update', 'insert'] } } }
                    ], { fullDocument: 'updateLookup' });
                    jobChangestream.on('change', data => {
                        if (data.operationType === 'update' &&
                            data.updateDescription &&
                            data.updateDescription.updatedFields &&
                            data.updateDescription.updatedFields.status
                        ) {
                            pubsub.publish(subscriptionEvents.JOB_STATUS_CHANGE, {
                                subscribeToJobStatusChange: {
                                    jobId: data.fullDocument?.id,
                                    studyId: data.fullDocument?.studyId,
                                    newStatus: data.fullDocument?.status,
                                    errors: data.fullDocument?.status === 'error' ? data.fullDocument.error : null
                                }
                            });
                        }
                    });
                    _this.router = new Router(this.config);

                    // Return the Express application
                    return resolve(_this.router);

                }).catch((err) => reject(err));

            // notice users of expiration
            setInterval(async () => {
                const now = Date.now().valueOf();
                const threshold = now + 7 * 24 * 60 * 60 * 1000;
                // update info if not set before
                await db.collections!.users_collection.updateMany({ deleted: null, emailNotificationsStatus: null }, {
                    $set: { emailNotificationsStatus: { expiringNotification: false } }
                });
                const users = await db.collections!.users_collection.find<IUser>({
                    'expiredAt': {
                        $lte: threshold,
                        $gt: now
                    },
                    'type': { $ne: userTypes.ADMIN },
                    'emailNotificationsActivated': true,
                    'emailNotificationsStatus.expiringNotification': false,
                    'deleted': null
                }).toArray();
                for (const user of users) {
                    await mailer.sendMail({
                        from: `${config.appName} <${config.nodemailer.auth.user}>`,
                        to: user.email,
                        subject: `[${config.appName}] Account is going to expire!`,
                        html: `
                    <p>
                        Dear ${user.firstname},
                    <p>
                    <p>
                        Your account will expire at ${new Date(user.expiredAt).toDateString()}.
                        You can make a request on the login page at ${config.appName}.
                    </p>

                    <br/>
                    <p>
                        The ${config.appName} Team.
                    </p>
                `
                    });
                    await db.collections!.users_collection.findOneAndUpdate({ id: user.id }, {
                        $set: { emailNotificationsStatus: { expiringNotification: true } }
                    });
                }
            }, 24 * 60 * 60 * 1000); // check every 24 hours
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

export default ITMATInterfaceServer;

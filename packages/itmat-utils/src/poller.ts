import mongodb from 'mongodb';
import * as Models from './models';
import { Logger } from './logger';

export class Poller {
    private intervalObj?: NodeJS.Timer;
    private readonly matchObj: any;

    constructor(
        private readonly identity: string,
        private readonly jobType: string | undefined, // if undefined, matches all jobs
        private readonly jobCollection: mongodb.Collection,
        private readonly pollingFrequency: number,
        private readonly action: (document: any) => {}
        ) {
        this.setInterval = this.setInterval.bind(this);
        this.cb = this.cb.bind(this);
        this.matchObj = {
            claimedBy: undefined
            /*, lastClaimed: more then 0 */
        };
        if (this.jobType !== undefined) { this.matchObj.jobType = this.jobType; }
    }

    public setInterval() {
        this.intervalObj = setInterval(this.cb, this.pollingFrequency);
    }

    private async cb() {
        console.log('polling');
        let updateResult: mongodb.FindAndModifyWriteOpResultObject;
        try {
            updateResult = await this.jobCollection.findOneAndUpdate(this.matchObj, { $set: {
                claimedBy: this.identity,
                lastClaimed: new Date().valueOf(),
                status: 'PROCESSING'
            }},
            { maxTimeMS : 30 });
        } catch (e) {
            console.log(e);
            return;
        }

        if (updateResult !== undefined && updateResult.ok === 1 && updateResult.value !== null) {
            Logger.log(`Claimed job ${this.jobType} id: ${updateResult.value.id}`);
            clearInterval(this.intervalObj!);
            await this.action(updateResult.value);
            Logger.log(`Finished processing job ${this.jobType} id: ${updateResult.value.id}.`);
            this.setInterval();
        } else if (updateResult.ok !== 1) {
            console.log(updateResult);
        }
    }
}

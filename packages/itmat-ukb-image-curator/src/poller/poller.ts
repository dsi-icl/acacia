import mongodb from 'mongodb';
import { Models } from 'itmat-utils';

/**
 * Task of poller:
 * - check mongo job collection for empty job of specific type
 */

export class Poller {
    private intervalObj?: NodeJS.Timer;
    constructor(private readonly jobCollection: mongodb.Collection, private readonly pollingFrequency: number, private readonly action: (document: Models.JobModels.IJobEntry<any>) => {} ) {
        this.cb = this.cb.bind(this);
    }

    public setInterval() {
        console.log('setting interval');
        this.intervalObj = setInterval(this.cb, this.pollingFrequency);
    }

    private async cb() {
        console.log('polling');
        let updateResult: mongodb.FindAndModifyWriteOpResultObject;
        try {
            updateResult = await this.jobCollection.findOneAndUpdate({ jobType: 'UKB_IMAGE_UPLOAD', claimedBy: undefined /*, lastClaimed: more then 0 */}, { $set: {
                claimedBy: 'me!',
                lastClaimed: new Date().valueOf()
            }});
        } catch (e) {
            console.log(e);
            return;
        }

        if (updateResult !== undefined && updateResult.ok === 1) {
            clearInterval(this.intervalObj!);
            await this.action(updateResult.value);
            console.log('reset intervl');
            this.intervalObj = setInterval(this.cb, this.pollingFrequency);
        }
    }
}

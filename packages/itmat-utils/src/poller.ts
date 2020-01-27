import * as mongodb from 'mongodb';
import { Logger } from './logger';

export interface IJobPollerConfig {
    identity: string; // a string identifying the server; this is just to keep track in mongo
    jobType?: string; // if undefined, matches all jobs
    jobCollection: mongodb.Collection; // collection to poll
    pollingFrequency: number; // in ms
    action: (document: any) => void; // gets called every time there is new document
}

export class JobPoller {
    private intervalObj?: NodeJS.Timer;
    private readonly matchObj: any;

    private readonly identity: string;
    private readonly jobType?: string;
    private readonly jobCollection: mongodb.Collection;
    private readonly pollingFrequency: number;
    private readonly action: (document: any) => void;

    constructor(config: IJobPollerConfig) {
        this.identity = config.identity;
        this.jobType = config.jobType;
        this.jobCollection = config.jobCollection;
        this.pollingFrequency = config.pollingFrequency;
        this.action = config.action;

        this.setInterval = this.setInterval.bind(this);
        this.checkForJobs = this.checkForJobs.bind(this);
        this.matchObj = {
            claimedBy: undefined
            /*, lastClaimed: more then 0 */
        };

        /* if this.jobType = config.jobType is undefined that this poller polls every job type */
        if (this.jobType !== undefined) { this.matchObj.jobType = this.jobType; }
    }

    public setInterval() {
        this.intervalObj = setInterval(this.checkForJobs, this.pollingFrequency);
    }

    private async checkForJobs() {
        Logger.log(`${this.identity} polling ${this.jobCollection} for new jobs of type ${this.jobType || 'ALL'}.`);
        let updateResult: mongodb.FindAndModifyWriteOpResultObject<any>;
        try {
            updateResult = await this.jobCollection.findOneAndUpdate(this.matchObj, {
                $set: {
                    claimedBy: this.identity,
                    lastClaimed: new Date().valueOf(),
                    status: 'PROCESSING'
                }
            },
                { maxTimeMS: 30 });
        } catch (e) {
            console.log(e);
            return;
        }

        if (updateResult !== undefined && updateResult.ok === 1 && updateResult.value !== null) {
            Logger.log(`Claimed job of type ${updateResult.value.jobType} - id: ${updateResult.value.id}`);
            clearInterval(this.intervalObj!);
            await this.action(updateResult.value);
            Logger.log(`Finished processing job of type ${updateResult.value.jobType} - id: ${updateResult.value.id}.`);
            this.setInterval();
        } else if (updateResult.ok !== 1) {
            Logger.error(updateResult);
        }
    }
}

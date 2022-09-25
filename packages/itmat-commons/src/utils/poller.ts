import type * as mongodb from 'mongodb';
import { IJobEntry } from '@itmat-broker/itmat-types';
import { Logger } from './logger';

export interface IJobPollerConfig {
    identity: string; // a string identifying the server; this is just to keep track in mongo
    jobType?: string; // if undefined, matches all jobs
    jobCollection: mongodb.Collection<IJobEntry<any>>; // collection to poll
    pollingInterval: number; // in ms
    action: (document: any) => void; // gets called every time there is new document
}

export class JobPoller {
    private intervalObj?: NodeJS.Timer;
    private readonly matchObj: any;

    private readonly identity: string;
    private readonly jobType?: string;
    private readonly jobCollection: mongodb.Collection<IJobEntry<any>>;
    private readonly pollingInterval: number;
    private readonly action: (document: any) => void;

    constructor(config: IJobPollerConfig) {
        this.identity = config.identity;
        this.jobType = config.jobType;
        this.jobCollection = config.jobCollection;
        this.pollingInterval = config.pollingInterval;
        this.action = config.action;

        this.setInterval = this.setInterval.bind(this);
        this.checkForJobs = this.checkForJobs.bind(this);
        this.matchObj = {
            claimedBy: undefined,
            status: 'QUEUED'
            /*, lastClaimed: more then 0 */
        };

        /* if this.jobType = config.jobType is undefined that this poller polls every job type */
        if (this.jobType !== undefined) { this.matchObj.jobType = this.jobType; }
    }

    public setInterval(): void {
        this.intervalObj = setInterval(this.checkForJobs, this.pollingInterval);
    }

    private async checkForJobs() {
        // Logger.log(`${this.identity} polling for new jobs of type ${this.jobType || 'ALL'}.`);
        let updateResult: mongodb.ModifyResult<IJobEntry<any>>;
        try {
            updateResult = await this.jobCollection.findOneAndUpdate(this.matchObj, {
                $set: {
                    claimedBy: this.identity,
                    lastClaimed: new Date().valueOf(),
                    status: 'PROCESSING'
                }
            });
        } catch (err) {
            //TODO Handle error recording
            Logger.error(`${this.identity} Errored picking up a job: ${err}`);
            return;
        }

        if (updateResult !== undefined && updateResult.ok === 1 && updateResult.value !== null) {
            Logger.log(`${this.identity} Claimed job of type ${updateResult.value.jobType} - id: ${updateResult.value.id}`);
            clearInterval(this.intervalObj!);
            await this.action(updateResult.value);
            Logger.log(`${this.identity} Finished processing job of type ${updateResult.value.jobType} - id: ${updateResult.value.id}.`);
            this.setInterval();
        } else if (updateResult.ok !== 1) {
            Logger.error(`${this.identity} Errored during database update: ${updateResult}`);
        }
    }
}

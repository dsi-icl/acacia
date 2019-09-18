import { Models, OpenStackSwiftObjectStore } from 'itmat-utils';
import { Database } from '../database/database';
import { IJobEntry } from 'itmat-utils/dist/models/job';
import { UKBFieldInfoPlugin } from '../plugins/fieldInfoPlugin';
import { JobHandler } from '../jobHandlers/jobHandlerInterface';

export class JobDispatcher {
    private _handlerCollection: {
        [jobType: string]: () => Promise<JobHandler>
    };

    constructor() { // tslint:disable-line
        this.dispatch = this.dispatch.bind(this);
        this._handlerCollection = {};
    }

    public registerJobType(jobType: string, getHandlerInstanceFunction: () => Promise<JobHandler>): void {
        this._handlerCollection[jobType] = getHandlerInstanceFunction;
    }

    public removeHandler(jobType: string): void {
        delete this._handlerCollection[jobType];
    }

    public async dispatch(job: IJobEntry<any>) {
        if (!this._handlerCollection[job.jobType]) {
            // set job to UNPROCESSED
        }
        await (await this._handlerCollection[job.jobType]()).execute(job);
    }
}
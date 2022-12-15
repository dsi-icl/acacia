import { IJobEntry } from '@itmat-broker/itmat-types';
import { JobHandler } from '../jobHandlers/jobHandlerInterface';

export class JobDispatcher {
    private _handlerCollection: {
        [jobType: string]: () => Promise<JobHandler>
    };

    constructor() {
        this.dispatch = this.dispatch.bind(this);
        this._handlerCollection = {};
    }

    public registerJobType(jobType: string, getHandlerInstanceFunction: () => Promise<JobHandler>): void {
        this._handlerCollection[jobType] = getHandlerInstanceFunction;
    }

    public removeHandler(jobType: string): void {
        delete this._handlerCollection[jobType];
    }

    public async dispatch(job: IJobEntry<any>): Promise<void> {
        if (!this._handlerCollection[job.jobType]) {
            //TODO set job to UNPROCESSED
            return;
        }
        await (await this._handlerCollection[job.jobType]()).execute(job);
    }
}

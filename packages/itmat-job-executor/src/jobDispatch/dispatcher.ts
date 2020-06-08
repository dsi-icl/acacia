import { IJobEntry } from 'itmat-commons';
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
        console.log(this._handlerCollection, job.jobType);
        if (!this._handlerCollection[job.jobType]) {
            // set job to UNPROCESSED
            console.log('NO JOB HANDLER AVAILLABLE');
            return;
        }
        await (await this._handlerCollection[job.jobType]()).execute(job);
    }
}

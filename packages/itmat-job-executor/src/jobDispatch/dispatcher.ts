import { IJob, enumJobType, IJobActionReturn} from '@itmat-broker/itmat-types';
import { JobHandler } from '../jobHandlers/jobHandlerInterface';
import { Logger } from '@itmat-broker/itmat-commons';


export class JobDispatcher {
    private _handlerCollection: {
        [jobType in enumJobType]?: () => Promise<JobHandler>
    };
    private _handlerInstances: {
        [jobType in enumJobType]?: JobHandler
    };

    constructor() {
        this.dispatch = this.dispatch.bind(this);
        this._handlerCollection = {};
        this._handlerInstances = {};
    }

    public registerJobType(jobType: enumJobType, getHandlerInstanceFunction: () => Promise<JobHandler>): void {
        this._handlerCollection[jobType] = getHandlerInstanceFunction;
    }

    public removeHandler(jobType: enumJobType): void {
        delete this._handlerCollection[jobType];
        delete this._handlerInstances[jobType];
    }

    public async dispatch(job: IJob): Promise<IJobActionReturn> {
        if (!this._handlerCollection[job.type]) {
            //TODO set job to UNPROCESSED
            Logger.error(`No JobHandler for job ${job.type}`);
            throw Error(`No JobHandler for job ${job.type}`);
        }

        let handler = this._handlerInstances[job.type];
        if (!handler) {
            const handlerFactory = this._handlerCollection[job.type];
            if (handlerFactory) {
                handler = await handlerFactory();
                this._handlerInstances[job.type] = handler;
            } else {
                throw new Error(`No JobHandler for job ${job.type}`);
            }
        }

        try {
            return await handler.execute(job);
        } catch (error) {
            return { successful: false, error };
        }
    }
}
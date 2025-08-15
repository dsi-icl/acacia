import { IJob, IJobActionReturn } from '@itmat-broker/itmat-types';

export abstract class JobHandler {
    /* subclass can decide either singleton
    (if there is expensive metadata collection) or
    just make this return new instance everytime.
    Gets called the first time when a job of the job type appears, so is lazily instantiated */
    public static async getInstance(): Promise<JobHandler> {
        throw new Error('Subclass must implement static getInstance method.');
    }

    /* called by job dispatcher */
    public abstract execute(document: IJob): Promise<IJobActionReturn>;
}

export type CodeRecords = Record<string, Array<{
    code: string;
    description: string;
}>>;
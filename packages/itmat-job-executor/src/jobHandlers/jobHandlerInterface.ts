import { IJobEntry } from '@itmat-broker/itmat-types';

export abstract class JobHandler {
    /* subclass can decide either singleton
    (if there is expensive metadata collection) or
    just make this return new instance everytime.
    Gets called the first time when a job of the job type appears, so is lazily instantiated */
    public abstract getInstance(): Promise<JobHandler>;

    /* called by job dispatcher */
    public abstract execute(document: IJobEntry<any>): Promise<void>;
}

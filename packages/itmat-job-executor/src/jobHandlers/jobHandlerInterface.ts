import { IJobEntry } from "itmat-utils/dist/models/job";

export abstract class JobHandler {
    protected constructor() { }

    /* subclass can decide either singleton 
    (if there is expensive metadata collection) or
    just make this return new instance everytime.
    Gets called the first time when a job of the job type appears, so is lazily instantiated */
    abstract getInstance(): Promise<JobHandler>;

    /* called by job dispatcher */
    abstract execute(document: IJobEntry<any>): Promise<void>;
}
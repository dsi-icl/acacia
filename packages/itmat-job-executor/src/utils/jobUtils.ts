import { Logger } from 'itmat-utils';
import mongodb from 'mongodb';

export class JobUtils {
    constructor(private readonly jobCollection: mongodb.Collection) {}

    public async setJobError(jobId: string, msg: string) {
        try {
            await this.jobCollection.updateOne({ id: jobId }, { $set: {
                error: msg,
                status: 'TERMINATED WITH ERROR'
            }});
        } catch (e) {
            Logger.error(`Cannot set job ${jobId} with error "${msg}"`);
        }
    }
}

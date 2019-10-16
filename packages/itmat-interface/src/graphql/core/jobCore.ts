import { db } from '../../database/database';
import uuidv4 from 'uuid/v4';
import { IJobEntry } from 'itmat-commons/dist/models/job';

export class JobCore {
    async createJob(userId: string, jobType: string, files: string[], studyId: string, projectId?: string, jobId?: string): Promise<IJobEntry<any>> {
        const job: IJobEntry<any> = {
            requester: userId,
            id: jobId || uuidv4(),
            studyId,
            jobType,
            projectId,
            requestTime: new Date().valueOf(),
            receivedFiles: files,
            status: 'QUEUED',
            error: null,
            cancelled: false,
        };
        await db.collections!.jobs_collection.insertOne(job);
        return job;
    }
}

export const jobCore = Object.freeze(new JobCore());
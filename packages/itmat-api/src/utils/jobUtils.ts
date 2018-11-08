import mongodb, { Collection } from 'mongodb';
import { Models } from 'itmat-utils';
import { server } from '../index';

/* all the authorization and injection attacks are checked prior, so everything here is assumed to be 'clean' */ 
/* checking for null result is not done here but in controllers */ 
export class JobUtils {
    public static async getAllJobs(sortByDate: Models.Enums.SortBy, username?: string, limit?: number): Promise<Models.JobModels.IJobEntry[]> {
        const queryObj: any = {};
        const optionObj: any = {
            sort: sortByDate === Models.Enums.SortBy.DESC ? { '_id': -1 } : { '_id': 1 },
            limit: 100,
            projection: { _id: 0 }
        };
        if (username !== undefined) { queryObj.requester = username; }
        if (limit !== undefined) { optionObj.limit = limit; }

        const cursor: mongodb.Cursor = (server.db.jobs_collection as Collection).find(queryObj, optionObj);
        return await cursor.toArray();
    }

    public static async getJobById(id: string): Promise<Models.JobModels.IJobEntry> {
        return await (server.db.jobs_collection as Collection).findOne({ id });
    }

    public static async createNewJob(jobEntry: Models.JobModels.IJobEntry): Promise<mongodb.InsertOneWriteOpResult> {
        return await (server.db.jobs_collection as Collection).insert(jobEntry);
    }

    public static async cancelJob(jobId: string): Promise<mongodb.UpdateWriteOpResult> {
        return await (server.db.jobs_collection as Collection).updateOne({ id: jobId }, { $set: { cancelledTime: new Date().valueOf(), cancelled: true, status: 'CANCELLED'}});
    }

}

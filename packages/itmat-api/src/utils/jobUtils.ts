import mongodb from 'mongodb';
import { APIDatabase } from '../database/database';
import { Models } from 'itmat-utils'; 


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

        const cursor: mongodb.Cursor = APIDatabase.jobs_collection.find(queryObj, optionObj);
        return await cursor.toArray();
    }

    public static async getJobById(id: string): Promise<Models.JobModels.IJobEntry> {
        return await APIDatabase.jobs_collection.findOne({ id });
    }

    public static async createNewJob(jobEntry: Models.JobModels.IJobEntry): Promise<mongodb.InsertOneWriteOpResult> {
        return await APIDatabase.jobs_collection.insert(jobEntry);
    }

    public static async cancelJob(jobId: string): Promise<mongodb.UpdateWriteOpResult> {
        return await APIDatabase.jobs_collection.updateOne({ id: jobId }, { $set: { cancelledTime: new Date().valueOf(), cancelled: true, status: 'CANCELLED'}});
    }

}

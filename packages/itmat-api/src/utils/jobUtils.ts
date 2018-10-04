import mongodb from 'mongodb';
import { APIDatabase } from '../database/database';
import { SortBy } from 'itmat-utils'; 

export interface Job {
    jobType: string,
}


export interface JobEntry extends Job {
    _id?: mongodb.ObjectId,
    files: string[],
    type: string,
    id: string,
    requester: string,
    numberOfTransferredFiles: number,
    numberOfFilesToTransfer: number,
    created: number,
    status: string, //cancel, uploading to database, transferring file..etc, finished successfully, finished with error
    carrier: string, //endpoint to call for upload file
    error: null | object,
    filesReceived?: object[],
    cancelled?: boolean,
    cancelledTime?: number
}

/* all the authorization and injection attacks are checked prior, so everything here is assumed to be 'clean' */ 
/* checking for null result is not done here but in controllers */ 
export class JobUtils {
    public static async getAllJobs(sortByDate: SortBy, username?: string, limit?: number): Promise<JobEntry[]> {
        const queryObj: any = {};
        const optionObj: any = {
            sort: sortByDate === SortBy.DESC ? { '_id': -1 } : { '_id': 1 },
            limit: 100,
            projection: { _id: 0 }
        };
        if (username !== undefined) { queryObj.requester = username; }
        if (limit !== undefined) { optionObj.limit = limit; }

        const cursor: mongodb.Cursor = APIDatabase.jobs_collection.find(queryObj, optionObj);
        return await cursor.toArray();
    }

    public static async createNewJob(jobEntry: JobEntry): Promise<mongodb.InsertOneWriteOpResult> {
        return await APIDatabase.jobs_collection.insert(jobEntry);
    }

    public static async cancelJob(jobId: string): Promise<mongodb.UpdateWriteOpResult> {
        return await APIDatabase.jobs_collection.updateOne({ id: jobId }, { $set: { cancelledTime: new Date().valueOf(), cancelled: true, status: 'CANCELLED'}});
    }

}

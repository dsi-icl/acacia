import mongodb from 'mongodb';
import { APIDatabase } from '../database/database';

export interface Job {
    id: string,
    type: string,
    files: string[],
    jobType: string,
}


export interface JobEntry extends Job {
    _id?: mongodb.ObjectId,
    requester: string,
    numberOfTransferredFiles: number,
    numberOfFilesToTransfer: number,
    created: number,
    status: string, //cancel, uploading to database, transferring file..etc, finished successfully, finished with error
    carrier: string, //endpoint to call for upload file
    filetype: string, //'UKB-CSV', 'CSV', 'Images'...etc
    error: null | object,
    filesReceived: object[]
}

/* all the authorization and injection attacks are checked prior, so everything here is assumed to be 'clean' */ 
/* checking for null result is not done here but in controllers */ 
export class JobUtils {
    public static async getAllJobsOfAUser(username: string): Promise<object[]> {
        const cursor: mongodb.Cursor = APIDatabase.jobs_collection.find({ deleted: false, requester: username }, { projection: { _id: -1 }});
        return await cursor.toArray();
    }

    public static async createNewJob(jobEntry: JobEntry): Promise<object> {
        return await APIDatabase.jobs_collection.insert(jobEntry);
    }

}

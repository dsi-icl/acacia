import { JobUtils, Job, JobEntry } from '../utils/jobUtils';
import uuidv4 from 'uuid/v4';
import { ItmatAPIReq } from '../server/requests';
import { APIDatabase } from '../database/database'; 
import { CustomError, checkIfReqKeysArePresent, APIErrorTypes, jobTypes } from 'itmat-utils';
import express from 'express';

class JobController {    //requests namespace defined globally in ../server/requests.d.ts
    public static async getJobsOfAUser(req: ItmatAPIReq<requests.GetJobsByUserReqBody>, res: express.Response): Promise<void> {
        if (!req.body || !req.body.user ) {
            
        }
    }

    public static async createJobForUser(req: ItmatAPIReq<Job>, res: express.Response): Promise<void> {
        const mustHaveKeysInBody = ['jobType'];
        if (!checkIfReqKeysArePresent(mustHaveKeysInBody, req)) {
            res.status(400).json(new CustomError(APIErrorTypes.missingRequestKey('body', mustHaveKeysInBody)));
            return;
        }
        if (!Object.keys(jobTypes).includes(req.body.jobType)) {
            res.status(400).json(new CustomError(APIErrorTypes.invalidReqKeyValue('jobType', ...Object.keys(jobTypes))));
            return;
        }
        // const entry: JobEntry = {
        //     id: uuidv4(),
        //     type: 'UPLOAD',
        //     files: jobTypes[req.body.jobType].requiredFiles,
        //     jobType: req.body.jobType,
        //     requester: req.user,
        //     numberOfFilesToTransfer: jobTypes[req.body.jobType].requiredFiles.length,
        //     numberOfTransferredFiles: 0,
        //     created: new Date().valueOf(),
        //     status: jobTypes[req.body.jobType].status[0],
        //     carrier: ,
        //     filetype: ,
        //     error: null,

        // }
        // APIDatabase.jobs_collection
        
    }
}
import { JobUtils, Job, JobEntry } from '../utils/jobUtils';
import uuidv4 from 'uuid/v4';
import { ItmatAPIReq } from '../server/requests';
import { APIDatabase } from '../database/database'; 
import { CustomError, APIErrorTypes, jobTypes, userTypes } from 'itmat-utils';
import { Express, Request, Response, NextFunction } from 'express';

class JobController {    //requests namespace defined globally in ../server/requests.d.ts
    public static async getJobsOfAUser(req: ItmatAPIReq<requests.GetJobsByUserReqBody>, res: Response): Promise<void> {
        if (!req.query || !req.query.user ) {
            res.status(400).json(new CustomError(APIErrorTypes.missingQueryString`user`));
            return;
        }
        if (req.query.user !== req.user.username || req.user.type !== userTypes.ADMIN) {
            res.status(400).json(new CustomError(APIErrorTypes.authorised));
            return;
        }
    }

    public static async createJobForUser(req: ItmatAPIReq<Job>, res: Response): Promise<void> {
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
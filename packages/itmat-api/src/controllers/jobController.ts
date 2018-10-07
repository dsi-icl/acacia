import { JobUtils, Job, JobEntry } from '../utils/jobUtils';
import uuidv4 from 'uuid/v4';
import { ItmatAPIReq } from '../server/requests';
import { APIDatabase } from '../database/database'; 
import mongodb from 'mongodb';
import { CustomError, APIErrorTypes, jobTypes, userTypes, SortBy, RequestValidationHelper, PlaceToCheck} from 'itmat-utils';
import { Express, Request, Response, NextFunction } from 'express';


export class JobController {    //requests namespace defined globally in ../server/requests.d.ts
    public static async getJobsOfAUser(req: ItmatAPIReq<requests.GetJobsByUserReqBody>, res: Response): Promise<void> {
        const { query } = req;
        let result: JobEntry[];
        const resultLimit = query && query.limit && !isNaN(parseInt(query.limit)) ? parseInt(query.limit) : undefined;

        let sortByDate = SortBy.DESC;
        if (query && query.sortByDate) {
            if (![SortBy.ASC, SortBy.DESC].includes(query.sortByDate)){
                res.status(400).json(new CustomError(`sortBy query can only be ${SortBy.ASC} or  ${SortBy.DESC}`));
                return;
            }
            if (query.sortByDate === SortBy.ASC) {
                sortByDate = SortBy.ASC;
            }
        }

        if (req.user.type !== userTypes.ADMIN) {
            result = await JobUtils.getAllJobs(sortByDate, query && query.username ? query.username : undefined, resultLimit);
        } else {
            result = await JobUtils.getAllJobs(sortByDate, req.user.username, resultLimit);
            res.status(200).send(result);
            return;
        }

        res.status(200).json(result);
    }

    public static async createJobForUser(req: ItmatAPIReq<Job>, res: Response): Promise<void> {
        if (!Object.keys(jobTypes).includes(req.body.jobType)) {
            // res.status(400).json(new CustomError(APIErrorTypes.invalidReqKeyValue('jobType', ...Object.keys(jobTypes))));
            return;
        }

        const entry: JobEntry = {
            id: uuidv4(),
            type: 'UPLOAD',
            files: jobTypes[req.body.jobType].requiredFiles,
            jobType: req.body.jobType,
            requester: req.user.username,
            numberOfFilesToTransfer: jobTypes[req.body.jobType].requiredFiles.length,
            numberOfTransferredFiles: 0,
            created: new Date().valueOf(),
            status: jobTypes[req.body.jobType].status[0],
            carrier: 'hardcoded CARIER URL',           ///TO_DO  
            error: null
        }
        let result: mongodb.InsertOneWriteOpResult;
        try {
            result = await APIDatabase.jobs_collection.insertOne(entry); //this adds an _id key in entry mutatably
        } catch (e) {
            res.status(500).json(new CustomError('Database error.', e));
            return;
        }
        
        switch (result.insertedCount) {
            case 1:
                break;
            case 0: 
                res.status(500).json(new CustomError('Server error. No job is created. Please try again.'));
            default:
                res.status(500).json(new CustomError('weird things.....'));
        }

        delete entry._id;
        res.status(200).send(entry);
        return;
    }


    public static async cancelJobForUser(req: ItmatAPIReq<requests.CancelJobReqBody>, res: Response): Promise<void> {   //admin and user himself can cancel jobs
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkRequiredKeysArePresentIn<requests.CancelJobReqBody>(PlaceToCheck.BODY, ['id'])
            .allOkay === false) return;
    
        const requestedJob: JobEntry = await JobUtils.getJobById(req.body.id);

        if (validator
            .checkSearchResultIsNotDefinedNorNull(requestedJob, 'job')
            .allOkay === false) return;
        
        if (req.user.type !== userTypes.ADMIN && requestedJob.requester !== req.user.username) {
            res.status(401).json(new CustomError(APIErrorTypes.authorised));
            return;
        }

        let result: mongodb.UpdateWriteOpResult;
        try {
            result = await JobUtils.cancelJob(req.body.id);
        } catch (e) {
            res.status(500).json(new CustomError('Database error.', e));
            return;
        }

        if (validator
            .checkSearchResultIsOne('job', result.modifiedCount)
            .allOkay === false) return;

        res.status(200).json({ message: `Job with id ${req.body.id} has been cancelled.`});
    }
}
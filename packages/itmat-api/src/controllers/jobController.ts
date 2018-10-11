import { JobUtils } from '../utils/jobUtils';
import uuidv4 from 'uuid/v4';
import { ItmatAPIReq } from '../server/requests';
import { APIDatabase } from '../database/database'; 
import mongodb from 'mongodb';
import { CustomError, RequestValidationHelper, Models } from 'itmat-utils';
import { Express, Request, Response, NextFunction } from 'express';
import { JobModels } from 'itmat-utils/dist/models';


export class JobController {    //requests namespace defined globally in ../server/requests.d.ts
    public static async getJobsOfAUser(req: ItmatAPIReq<requests.GetJobsByUserReqBody>, res: Response): Promise<void> {
        const { query } = req;
        const { Enums: { SortBy } } = Models;
        let result: Models.JobModels.IJobEntry[];
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

        if (req.user.type !== Models.UserModels.userTypes.ADMIN) {
            result = await JobUtils.getAllJobs(sortByDate, query && query.username ? query.username : undefined, resultLimit);
        } else {
            result = await JobUtils.getAllJobs(sortByDate, req.user.username, resultLimit);
            res.status(200).send(result);
            return;
        }

        res.status(200).json(result);
    }

    public static async createJobForUser(req: ItmatAPIReq<Models.JobModels.IJob>, res: Response): Promise<void> {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkForAdminPrivilege()
            .checkRequiredKeysArePresentIn<Models.JobModels.IJob>(Models.APIModels.Enums.PlaceToCheck.BODY, ['jobType'])
            .checkKeyForValidValue('jobType', req.body.jobType, Object.keys(Models.JobModels.jobTypes))
            .checksFailed) return;

        const entry: Models.JobModels.IJobEntry = {
            id: uuidv4(),
            type: 'UPLOAD',
            files: Models.JobModels.jobTypes[req.body.jobType].requiredFiles,
            jobType: req.body.jobType,
            requester: req.user.username,
            filesReceived: [],
            numberOfFilesToTransfer: Models.JobModels.jobTypes[req.body.jobType].requiredFiles.length,
            numberOfTransferredFiles: 0,
            created: new Date().valueOf(),
            status: Models.JobModels.jobTypes[req.body.jobType].status[0],
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
            .checkRequiredKeysArePresentIn<requests.CancelJobReqBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['id'])
            .checksFailed) return;
    
        const requestedJob: Models.JobModels.IJobEntry = await JobUtils.getJobById(req.body.id);

        if (validator
            .checkSearchResultIsNotDefinedNorNull(requestedJob, 'job')
            .checksFailed) return;
        
        if (req.user.type !== Models.UserModels.userTypes.ADMIN && requestedJob.requester !== req.user.username) {
            res.status(401).json(new CustomError(Models.APIModels.Errors.authorised));
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
            .checksFailed) return;
            
        res.status(200).json({ message: `Job with id ${req.body.id} has been cancelled.`});
    }
}
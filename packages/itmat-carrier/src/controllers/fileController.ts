import { objectStore } from '../objectStore/OpenStackObjectStore';
import { ItmatCarrierReq } from '../server/requests';
import { CarrierDatabase } from '../database/database';
import { Models, RequestValidationHelper, CustomError } from 'itmat-utils';
import { UserUtils } from '../utils/userUtils';
import { Express, Request, Response, NextFunction } from 'express';
import { runInNewContext } from 'vm';


declare global { 
    namespace Express {
        namespace Multer {
            interface File {
                stream: NodeJS.ReadableStream;
            }
        }
    }
}

export class FileController {
    public static async uploadFile(req: ItmatCarrierReq<requests.FileUploadReqBody>, res: Response, next: NextFunction): Promise<void> {
        const validator = new RequestValidationHelper(req, res);    //what if the person sends the same files to two carriers
        //maybe a script for checking integrity. 
        //this doesn't include images..
        if (validator
            .checkForAdminPrivilege()
            .checkRequiredKeysArePresentIn<requests.FileUploadReqBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['fileName', 'jobId'])
            .checkForValidDataTypeForValue(req.body.fileName, Models.Enums.JSDataType.STRING, 'fileName')
            .checkForValidDataTypeForValue(req.body.jobId, Models.Enums.JSDataType.STRING, 'jobId')
            .checksFailed) return;

        const jobSearchResult: Models.JobModels.IJobEntry = await CarrierDatabase.jobs_collection.findOne({ id: req.body.jobId });

        if (validator
            .checkSearchResultIsNotDefinedNorNull(jobSearchResult, 'job')
            .checksFailed) return;

        const user: Models.UserModels.IUserWithoutToken = req.user as Models.UserModels.IUserWithoutToken;

        if (user.username !== jobSearchResult.requester) {
            res.status(401).json(new CustomError(Models.APIModels.Errors.authorised));
            return;
        }

        if (jobSearchResult.cancelled === true) {
            res.status(400).json(new CustomError('Job was cancelled.'));
            return;
        }

        if (validator
            .checkKeyForValidValue('fileName', req.body.fileName, jobSearchResult.files)
            .checksFailed) return;

        try {
            await objectStore.uploadFile(req.file.stream, jobSearchResult, req.body.fileName);
        } catch (e) {
            res.status(500).json(new CustomError('Cannot upload file.', e));
            return;
        }

        if (jobSearchResult.filesReceived.includes(req.body.fileName)) {
            res.status(200).json({ message: 'File successfully replaced.'});
            return;
        } else {
            await CarrierDatabase.jobs_collection.updateOne({ id: req.body.jobId }, { $inc: { numberOfTransferredFiles: 1 }, $push: { filesReceived: req.body.fileName }});
            res.status(200).json({ message: 'File successfully uploaded.'});
            return;
        }
    }

    public static async downloadFile(req: ItmatCarrierReq<requests.FileDownloadReqBody>, res: Response): Promise<void> {
        // TO_DO: how to restrict downloadfile to other microservices .
        const user: Models.UserModels.IUserWithoutToken = req.user as Models.UserModels.IUserWithoutToken;
        const validator = new RequestValidationHelper(req, res);
        const { jobId, fileName } = req.params;

        const jobSearchResult: Models.JobModels.IJobEntry = await CarrierDatabase.jobs_collection.findOne({ id: jobId });

        if (validator
            .checkSearchResultIsNotDefinedNorNull(jobSearchResult, 'job')
            .checkKeyForValidValue('fileName', fileName, jobSearchResult.filesReceived)
            .checksFailed) return;

        
        let fileStream: NodeJS.ReadableStream;
        try {
            fileStream = await objectStore.downloadFile(fileName, jobSearchResult);
        } catch (e) {
            res.status(500).json(new CustomError('Cannot download file', e));
            return;
        }
        
        fileStream.on('data', (data) => {
            res.write(data);
        });

        fileStream.on('end', () => {
            res.end();
        })
        
        return;
    }
}
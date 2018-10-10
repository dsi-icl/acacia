import { objectStore } from '../objectStore/OpenStackObjectStore';
import { ItmatCarrierReq } from '../server/requests';
import { CarrierDatabase } from '../database/database';
import { Models, RequestValidationHelper, CustomError } from 'itmat-utils';
import { UserUtils } from '../utils/userUtils';
import { Express, Request, Response, NextFunction } from 'express';
import { runInNewContext } from 'vm';


export class FileController {
    public static async uploadFileChecks(req: ItmatCarrierReq<requests.FileUploadReqBody>, res: Response, next: NextFunction): Promise<void> {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkForAdminPrivilege()
            .checkRequiredKeysArePresentIn<requests.FileUploadReqBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['fileName', 'file', 'jobId'])
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

        next();
    }


    public static async downloadFile(req: ItmatCarrierReq<requests.FileDownloadReqBody>, res: Response): Promise<void> {
        const user: Models.UserModels.IUserWithoutToken = req.user as Models.UserModels.IUserWithoutToken;
        return;
    }
}
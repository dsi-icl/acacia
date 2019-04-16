import { ItmatAPIReq } from './requestInterface';
import { Database } from '../database/database';
import { Models, CustomError, OpenStackSwiftObjectStore } from 'itmat-utils';
import { Express, Request, Response, NextFunction } from 'express';
import mongodb from 'mongodb';
import uuidv4 from 'uuid/v4';

declare global {
    namespace Express {
        namespace Multer {
            interface File {
                stream: NodeJS.ReadableStream;
                originalName: string;
            }
        }
    }
}

interface FileUploadReqBody {
    jobType: string,
    study: string,
    file: any,
    field?: string, // xxx-yy.z
    patientId?: string
}

export class FileController {
    constructor(private readonly db: Database, private readonly objStore: OpenStackSwiftObjectStore) {
        this.uploadFile = this.uploadFile.bind(this);
        this.downloadFile = this.downloadFile.bind(this);

    }

    public async uploadFile(req: ItmatAPIReq<FileUploadReqBody>, res: Response, next: NextFunction): Promise<void> {
      //  const validator = new RequestValidationHelper(req, res);
      //  // TO_DO: check study exists, check no spaces in file name
      //  // TO_DO: change this to a dispatcher for different types of jobs
      //  // TO_DO: check if study exists, whetehr the requester is the dataAdmin / admin;
      //  if (validator
      //      .checkForAdminPrivilege()
      //      .checkRequiredKeysArePresentIn<FileUploadReqBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['jobType', 'study'])
      //      .checkForValidDataTypeForValue(req.body.study, Models.Enums.JSDataType.STRING, 'study')
      //      .checkForValidDataTypeForValue(req.body.jobType, Models.Enums.JSDataType.STRING, 'jobType')
      //      .checkKeyForValidValue('jobType', req.body.jobType, Object.keys(Models.JobModels.jobTypes))
      //      .checkSearchResultIsNotDefinedNorNull(req.file, 'file')
      //      .checkSearchResultIsNotDefinedNorNull(req.file.originalName, 'Original file name')
      //      .checkStringDoesNotHaveSpace(req.file.originalName, 'file name')
      //      .checksFailed) { return; }

      //  
      //  if (req.body.jobType === 'UKB_IMAGE_UPLOAD') {
      //      if (validator
      //          .checkForAdminPrivilege()
      //          .checkRequiredKeysArePresentIn<FileUploadReqBody>(Models.APIModels.Enums.PlaceToCheck.BODY, ['field', 'patientId'])
      //          .checkForValidDataTypeForValue(req.body.field, Models.Enums.JSDataType.STRING, 'field')
      //          .checkForValidDataTypeForValue(req.body.patientId, Models.Enums.JSDataType.STRING, 'patientId')
      //          .checksFailed) { return; }
      //  }

      //  let studySearch: Models.Study.IStudy;
      //  try {
      //      studySearch = await this.db.studies_collection!.findOne({ name: req.body.study })!;
      //  } catch (e) {
      //      console.log(e);
      //      res.status(500).json(new CustomError('Server error.'));
      //      return;
      //  }

      //  if (validator
      //      .checkSearchResultIsNotDefinedNorNull(studySearch, `study '${req.body.study}' `)
      //      .checksFailed) { return; }

      //  const jobId = uuidv4();

      //  try {
      //      await this.objStore.uploadFile(req.file.stream, jobId, req.file.originalName);
      //  } catch (e) {
      //      res.status(500).json(new CustomError('Cannot upload file.', e));
      //      return;
      //  }

      //  const jobEntry: Models.JobModels.IJobEntry<any> = {
      //      id: jobId,
      //      study: req.body.study,
      //      jobType: req.body.jobType,
      //      requester: req.user!.username,
      //      receivedFiles: req.file.originalName,
      //      status: 'RECEIVED FILE',
      //      error: null,
      //      cancelled: false
      //  };

      //  if (req.body.jobType === 'UKB_IMAGE_UPLOAD') {
      //      jobEntry.data = {
      //          patientId: req.body.patientId,
      //          field: req.body.field
      //      };
      //  }

      //  try {
      //      await this.db.jobs_collection!.insertOne(jobEntry);
      //  } catch (e) {
      //      console.log(e);
      //      res.status(500).json(new CustomError('Server error.'));
      //      return;
      //  }

      //  res.status(200).json({ jobId });
      //  return;
    }

    public async downloadFile(req: ItmatAPIReq<undefined>, res: Response): Promise<void> {
        // // TO_DO: how to restrict downloadfile to other microservices .
        // // TO_DO: check whether the job is by the user; bounce if not
        // const user: Models.UserModels.IUserWithoutToken = req.user as Models.UserModels.IUserWithoutToken;
        // const validator = new RequestValidationHelper(req, res);
        // const { jobId, fileName } = req.params;

        // const jobSearchResult: Models.JobModels.IJobEntry = await this.db.jobs_collection!.findOne({ id: jobId });

        // if (validator
        //     .checkSearchResultIsNotDefinedNorNull(jobSearchResult, 'job')
        //     .checkKeyForValidValue('fileName', fileName, jobSearchResult.filesReceived)
        //     .checksFailed)  { return; }

        // let fileStream: NodeJS.ReadableStream;
        // try {
        //     fileStream = await this.objStore.downloadFile(fileName, jobSearchResult.id);
        // } catch (e) {
        //     res.status(500).json(new CustomError('Cannot download file', e));
        //     return;
        // }

        // fileStream.on('data', data => {
        //     res.write(data);
        // });

        // fileStream.on('end', () => {
        //     res.end();
        // });

        return;
    }
}
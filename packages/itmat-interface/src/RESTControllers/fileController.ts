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
        this.downloadFile = this.downloadFile.bind(this);

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
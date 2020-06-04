import { IFile } from 'itmat-commons/dist/models/file';
import { IJobEntry } from 'itmat-commons/dist/models/job';
import { IStudyDataVersion } from 'itmat-commons/dist/models/study';
import { v4 as uuid } from 'uuid';
import { db } from '../database/database';
import { objStore } from '../objStore/objStore';
import { JobHandler } from './jobHandlerInterface';
import { CSVCurator } from '../curation/CSVCurator';

export class DATA_BLOB_UPLOAD_Handler extends JobHandler {
    private _instance?: DATA_BLOB_UPLOAD_Handler;
    // private ukbCurator: UKBCurator;

    public async getInstance() {
        if (!this._instance) {
            this._instance = new DATA_BLOB_UPLOAD_Handler();
        }
        return this._instance;
    }

    public async execute(job: IJobEntry<{ dataVersion: string, versionTag?: string }>) {
        const file: IFile = await db.collections!.files_collection.findOne({ id: job.receivedFiles[0], deleted: null })!;
        if (!file) {
            // throw error
        }
        const fileStream: NodeJS.ReadableStream = await objStore.downloadFile(job.studyId, file.uri);
    }

}

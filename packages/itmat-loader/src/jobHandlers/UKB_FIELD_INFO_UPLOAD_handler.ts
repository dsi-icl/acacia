import { JobHandler } from './jobHandlerInterface';
import { IJobEntry } from 'itmat-utils/dist/models/job';
import { objStore } from '../objStore/objStore';
import { db } from '../database/database';
import { UKBFieldInfoPlugin } from '../plugins/fieldInfoPlugin';

export class UKB_FIELD_INFO_UPLOAD_Handler extends JobHandler {
    private _instance?: UKB_FIELD_INFO_UPLOAD_Handler;

    public async getInstance() {
        if (!this._instance) {
            this._instance = new UKB_FIELD_INFO_UPLOAD_Handler();
        }
        return this._instance;
    }

    async execute(job: IJobEntry<undefined>) {
        const fileStream: NodeJS.ReadableStream = await objStore.downloadFile(job.receivedFiles[0], job.id);
        const ukbfieldprocessor = new UKBFieldInfoPlugin(job.id, job.studyId);
        ukbfieldprocessor.setDBClient(db.db).setInputStream(fileStream).setTargetCollection('FIELD_COLLECTION');
        await ukbfieldprocessor.processInputStreamToFieldEntry();
    }
}
import { IJobEntry } from 'itmat-utils/dist/models/job';
import { db } from '../database/database';
import { objStore } from '../objStore/objStore';
import { UKBFieldInfoPlugin } from '../plugins/fieldInfoPlugin';
import { JobHandler } from './jobHandlerInterface';

type IFieldCurationJobEntry = IJobEntry<{ dataVersionId: string, tag: string }>;

export class UKB_FIELD_INFO_UPLOAD_Handler extends JobHandler {
    private _instance?: UKB_FIELD_INFO_UPLOAD_Handler;

    public async getInstance() {
        if (!this._instance) {
            this._instance = new UKB_FIELD_INFO_UPLOAD_Handler();
        }
        return this._instance;
    }

    public async execute(job: IFieldCurationJobEntry) {
        const fileStream: NodeJS.ReadableStream = await objStore.downloadFile(job.receivedFiles[0], job.id);
        const ukbfieldprocessor = new UKBFieldInfoPlugin(job.id, job.studyId);
        ukbfieldprocessor.setDBClient(db.db).setInputStream(fileStream).setTargetCollection('FIELD_COLLECTION');
        await ukbfieldprocessor.processInputStreamToFieldEntry();
    }

    public async uploadStudyOnMongo(job: IFieldCurationJobEntry, fieldTreeId: string) {
        const result = await db.collections!.studies_collection.update(
            { studyId: job.studyId, deleted: false,  dataVersions: job.data!.dataVersionId },
            { $push: { 'dataVersions.$.fieldTrees': fieldTreeId }},
        );

    }
}

import { db } from '../database/database';
import { objStore } from '../objStore/objStore';
import { JobHandler } from './jobHandlerInterface';
import { IJobEntryForFieldCuration } from 'itmat-commons/dist/models/job';
import { IFile } from 'itmat-commons/dist/models/file';
import uuid from 'uuid/v4';
import { FieldCurator } from '../curation/FieldCurator';

export class UKB_FIELD_INFO_UPLOAD_Handler extends JobHandler {
    private _instance?: UKB_FIELD_INFO_UPLOAD_Handler;

    public async getInstance() {
        if (!this._instance) {
            this._instance = new UKB_FIELD_INFO_UPLOAD_Handler();
        }
        return this._instance;
    }

    public async execute(job: IJobEntryForFieldCuration) {
        const file: IFile = await db.collections!.files_collection.findOne({ id: job.receivedFiles[0], deleted: null })!;
        if (!file) {
            // throw error
        }
        const fileStream: NodeJS.ReadableStream = await objStore.downloadFile(job.studyId, file.uri);
        const fieldTreeId: string = uuid();
        const fieldcurator = new FieldCurator(
            db.collections!.field_dictionary_collection,
            fileStream,
            undefined,
            job,
            fieldTreeId
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();

        if (errors.length !== 0) {
            await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'error', error: errors } });
            return;
        } else {
            await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'finished' } });
            await this.updateFieldTreesInMongo(job, fieldTreeId);
        }

    }

    public async updateFieldTreesInMongo(job: IJobEntryForFieldCuration, fieldTreeId: string) {
        const queryObject = { 'id': job.studyId, 'deleted': null,  'dataVersions.id': job.data!.dataVersionId };
        const updateObject = { $push: { 'dataVersions.$.fieldTrees': fieldTreeId }};
        const result = await db.collections!.studies_collection.findOneAndUpdate(queryObject, updateObject);
    }
}

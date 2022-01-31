import { IFile, IJobEntry } from 'itmat-commons';
import { db } from '../database/database';
import { objStore } from '../objStore/objStore';
import { JobHandler } from './jobHandlerInterface';
import { JSONCurator } from '../curation/JSONCurator';
import { Readable } from 'stream';

export class UKB_JSON_UPLOAD_Handler extends JobHandler {
    private _instance?: UKB_JSON_UPLOAD_Handler;
    // private ukbCurator: UKBCurator;

    public async getInstance() {
        if (!this._instance) {
            this._instance = new UKB_JSON_UPLOAD_Handler();
        }
        return this._instance;
    }

    public async execute(job: IJobEntry<never>) {
        const errorsList = [];
        // get fieldid info from database
        const fieldsList = await db.collections!.field_dictionary_collection.find({ studyId: job.studyId }).toArray();

        for (const fileId of job.receivedFiles) {
            try {
                const file: IFile = await db.collections!.files_collection.findOne({ id: fileId, deleted: null })!;
                if (!file) {
                    errorsList.push({fileId: fileId, error: 'file does not exist'});
                    continue;
                }
                const components = file.fileName.split('.')[0].split('_');
                components.shift();
                const tableName = components.join('_');
                const filteredFieldsList = fieldsList.filter(el => el.tableName === tableName);
                const fileStream: Readable = await objStore.downloadFile(job.studyId, file.uri);
                const jsoncurator = new JSONCurator(
                    db.collections!.data_collection,
                    fileStream,
                    job,
                    filteredFieldsList
                );
                const errors = await jsoncurator.processIncomingStreamAndUploadToMongo();
                if (errors.length !== 0) {
                    errorsList.push({fileId: file.id, fileName: file.fileName, error: errors});
                    await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'error', error: errorsList } });
                } else {
                    await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'finished' } });
                }
            } catch (e) {
                throw new Error();
            }
        }
    }
}

import { JobHandler } from './jobHandlerInterface';
import { IJobEntry } from 'itmat-utils/dist/models/job';
import { objStore } from '../objStore/objStore';
import { db } from '../database/database';
import { UKBCurator } from 'ukb-curator';

export class UKB_CSV_UPLOAD_Handler extends JobHandler {
    private _instance?: UKB_CSV_UPLOAD_Handler;
    private ukbCurator: UKBCurator;

    private constructor() {
        super();
        this.ukbCurator = new UKBCurator(
            db.collections!.jobs_collection,
            db.collections!.UKB_coding_collection,
            db.collections!.field_dictionary_collection,
            db.collections!.data_collection
        );
    }

    public async getInstance() {
        if (!this._instance) {
            this._instance = new UKB_CSV_UPLOAD_Handler();
            await this.ukbCurator.updateUKBCodingAndFieldsMap();
        }
        return this._instance;
    }

    async execute(job: IJobEntry<undefined>) {
        const fileStream: NodeJS.ReadableStream = await objStore.downloadFile(job.receivedFiles[0], job.id);
        await this.ukbCurator.uploadIncomingCSVStreamToMongo(
            job.studyId,
            job.id,
            job.receivedFiles[0],
            fileStream
        );
        await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'finished' } });

    }

}
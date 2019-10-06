// import { UKBCurator } from 'ukb-curator';
import { IFile } from 'itmat-utils/dist/models/file';
import { IJobEntry } from 'itmat-utils/dist/models/job';
import { IStudyDataVersion } from 'itmat-utils/dist/models/study';
import uuid from 'uuid/v4';
import { db } from '../database/database';
import { objStore } from '../objStore/objStore';
import { JobHandler } from './jobHandlerInterface';

export class UKB_CSV_UPLOAD_Handler extends JobHandler {
    private _instance?: UKB_CSV_UPLOAD_Handler;
    // private ukbCurator: UKBCurator;

    private constructor() {
        super();
        // this.ukbCurator = new UKBCurator(
        //     db.collections!.jobs_collection,
        //     db.collections!.UKB_coding_collection,
        //     db.collections!.field_dictionary_collection,
        //     db.collections!.data_collection
        // );
    }

    public async getInstance() {
        if (!this._instance) {
            this._instance = new UKB_CSV_UPLOAD_Handler();
            // await this.ukbCurator.updateUKBCodingAndFieldsMap();
        }
        return this._instance;
    }

    public async execute(job: IJobEntry<{ dataVersion: string, versionTag?: string }>) {
        const file: IFile = await db.collections!.files_collection.findOne({ id: job.receivedFiles[0], deleted: false })!;
        if (!file) {
            // throw error
        }
        const fileStream: NodeJS.ReadableStream = await objStore.downloadFile(job.studyId, file.uri);
        const datasetId: string = uuid();
        // await this.ukbCurator.uploadIncomingCSVStreamToMongo(
        //     job.studyId,
        //     job.id,
        //     job.receivedFiles[0],
        //     fileStream
        // );
        await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'finished' } });
        const newDataVersion: IStudyDataVersion = {
            id: datasetId,
            contentId: uuid(),
            jobId: job.id,
            version: job.data!.dataVersion,
            tag: job.data!.versionTag,
            uploadDate: new Date().valueOf(),
            fileSize: file.fileSize!,
            extractedFrom: file.fileName,
            fieldTrees: [],
        };
        await db.collections!.studies_collection.updateOne({ id: job.studyId }, {
            $push: { dataVersions: newDataVersion },
            $inc: {
                currentDataVersion: 1,
            },

        });
    }

}

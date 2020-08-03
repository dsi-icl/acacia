import { IFile, IJobEntry, IStudyDataVersion } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
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

    public async execute(job: IJobEntry<{ dataVersion: string, versionTag?: string }>) {
        const file: IFile = await db.collections!.files_collection.findOne({ id: job.receivedFiles[0], deleted: null })!;
        if (!file) {
            // throw error
        }
        const fileStream: Readable = await objStore.downloadFile(job.studyId, file.uri);
        const versionId: string = uuid();
        const jsoncurator = new JSONCurator(
            db.collections!.data_collection,
            fileStream,
            job,
            versionId
        );
        const errors = await jsoncurator.processIncomingStreamAndUploadToMongo();

        if (errors.length !== 0) {
            await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'error', error: errors } });
            return;
        } else {
            await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'finished' } });
        }

        const newDataVersion: IStudyDataVersion = {
            id: versionId,
            contentId: uuid(), // same content = same id - used in reverting data, version control
            jobId: job.id,
            version: job.data!.dataVersion,
            tag: job.data!.versionTag,
            uploadDate: (new Date().valueOf()).toString(),
            fileSize: (file.fileSize!).toString(),
            extractedFrom: file.fileName,
            fieldTrees: []
        };
        await db.collections!.studies_collection.updateOne({ id: job.studyId }, {
            $push: { dataVersions: newDataVersion },
            $inc: {
                currentDataVersion: 1
            }
        });
    }
}

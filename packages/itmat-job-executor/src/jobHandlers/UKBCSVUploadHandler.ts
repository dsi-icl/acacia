import { IFile } from 'itmat-commons/dist/models/file';
import { IJobEntry } from 'itmat-commons/dist/models/job';
import { IStudyDataVersion } from 'itmat-commons/dist/models/study';
import { v4 as uuid } from 'uuid';
import { db } from '../database/database';
import { JobHandler } from './jobHandlerInterface';
import { CSVCurator } from '../curation/CSVCurator';
import { objStore } from '../objStore/objStore';

export class UKBCSVUploadHandler extends JobHandler {
    private _instance?: UKBCSVUploadHandler;
    // private ukbCurator: UKBCurator;

    public async getInstance() {
        if (!this._instance) {
            this._instance = new UKBCSVUploadHandler();
        }
        return this._instance;
    }

    public async execute(job: IJobEntry<{ dataVersion: string, versionTag?: string }>) {
        const file: IFile = await db.collections!.files_collection.findOne({ id: job.receivedFiles[0], deleted: null })!;
        if (!file) {
            // throw error
        }
        const fileStream: NodeJS.ReadableStream = await objStore.downloadFile(job.studyId, file.uri);
        const versionId: string = uuid();
        const csvcurator = new CSVCurator(
            db.collections!.data_collection,
            fileStream,
            undefined,
            job,
            versionId
        );
        const errors = await csvcurator.processIncomingStreamAndUploadToMongo();


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
            uploadDate: new Date().valueOf(),
            fileSize: file.fileSize!,
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

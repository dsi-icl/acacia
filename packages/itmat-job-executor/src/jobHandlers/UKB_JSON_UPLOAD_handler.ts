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
        // check if data version exists
        const study = await db.collections!.studies_collection.findOne(
            {
                id: job.studyId
            }
        );
        let isVersionExist;
        let updatedDataVersionId;
        if (study) {
            // do not creat new data version
            const versionIds = study.dataVersions.filter(e => e.version === job.data!.dataVersion);
            if (versionIds.length === 0) {
                updatedDataVersionId = uuid();
                isVersionExist = false;
            } else {
                updatedDataVersionId = versionIds[0].id;
                isVersionExist = true;
            }
        } else {
            // create new data version

        }
        const errorsList = [];

        for (const fileId of job.receivedFiles) {
            try {
                const file: IFile = await db.collections!.files_collection.findOne({ id: fileId, deleted: null })!;
                if (!file) {
                    errorsList.push({fileId: fileId, error: 'file does not exist'});
                    continue;
                }

                const fileStream: Readable = await objStore.downloadFile(job.studyId, file.uri);
                const jsoncurator = new JSONCurator(
                    db.collections!.data_collection,
                    fileStream,
                    job,
                    updatedDataVersionId,
                    fileId
                );
                const errors = await jsoncurator.processIncomingStreamAndUploadToMongo();
                if (errors.length !== 0) {
                    errorsList.push({fileId: file.id, fileName: file.fileName, error: errors});
                }
            } catch (e) {
                throw new Error();
            }
        }

        if (errorsList.length !== 0) {
            await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'error', error: errorsList } });
            return;
        } else {
            await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'finished' } });
        }
        try {
            if (isVersionExist) {
                await db.collections!.studies_collection.findOneAndUpdate({
                    'id': job.studyId,
                    'dataVersions.id': updatedDataVersionId
                }, {
                    $set: {
                        // 'dataVersions.contentId':uuid(),
                        'dataVersions.$.updateDate': (new Date()).valueOf(),
                    },
                    $push: {
                        'dataVersions.$.extractedFrom': job.receivedFiles[0],
                        'dataVersions.$.jobId': job.id,
                    }
                });
            } else {
                await db.collections!.studies_collection.findOneAndUpdate({
                    id: job.studyId
                }, {
                    $inc: {
                        currentDataVersion: 1
                    },
                    $push: {
                        dataVersions: {
                            id: updatedDataVersionId,
                            contentId: uuid(),
                            jobId: [job.id],
                            updateDate: (new Date()).valueOf(),
                            version: job.data!.dataVersion,
                            tag: job.data!.versionTag,
                            extractedFrom: job.receivedFiles,
                            fieldTrees: []
                        }
                    }
                });
            }
        } catch (e) {
            console.log(e);
        }
    }
}

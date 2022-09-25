import { db } from '../database/database';
import { objStore } from '../objStore/objStore';
import { JobHandler } from './jobHandlerInterface';
import { IJobEntryForFieldCuration } from '@itmat-broker/itmat-types';
import { FieldCurator } from '../curation/FieldCurator';
import { Readable, Writable } from 'stream';
import * as csvparse from 'csv-parse';

export class UKB_FIELD_INFO_UPLOAD_Handler extends JobHandler {
    private _instance?: UKB_FIELD_INFO_UPLOAD_Handler;

    public async getInstance() {
        if (!this._instance) {
            this._instance = new UKB_FIELD_INFO_UPLOAD_Handler();
        }
        return this._instance;
    }

    public async execute(job: IJobEntryForFieldCuration) {
        const file = await db.collections!.files_collection.findOne({ id: job.receivedFiles[0], deleted: null })!;
        if (!file) {
            throw new Error('File does not exists.');
        }

        const codesFile = await db.collections!.files_collection.findOne({ fileName: 'prolific_Codes.csv' });
        if (!codesFile) {
            throw new Error('Codes File does not exists.');
        }

        const codesStream: Readable = await objStore.downloadFile(job.studyId, codesFile.uri);
        const codesObj = processCodesFileStreamAndReturnList(codesStream);

        const fileStream: Readable = await objStore.downloadFile(job.studyId, file.uri);
        const fieldcurator = new FieldCurator(
            db.collections!.field_dictionary_collection,
            fileStream,
            undefined,
            job,
            codesObj
        );
        const errors = await fieldcurator.processIncomingStreamAndUploadToMongo();

        if (errors.length !== 0) {
            await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'error', error: errors as any } });
            return;
        } else {
            await db.collections!.jobs_collection.updateOne({ id: job.id }, { $set: { status: 'finished' } });
            // await this.updateFieldTreesInMongo(job, fieldTreeId);
        }

    }

    // public async updateFieldTreesInMongo(job: IJobEntryForFieldCuration, fieldTreeId: string) {
    //     const queryObject = { 'id': job.studyId, 'deleted': null, 'dataVersions.id': job.data!.dataVersionId };
    //     const updateObject = { $push: { 'dataVersions.$.fieldTrees': fieldTreeId } };
    //     return await db.collections!.studies_collection.findOneAndUpdate(queryObject, updateObject);
    // }
}

function processCodesFileStreamAndReturnList(incomingStream: Readable): Promise<any> {
    const parseOptions: csvparse.Options = { delimiter: ',', quote: '"', relax_column_count: true, skip_records_with_error: true };
    const csvparseStream = csvparse.parse(parseOptions);
    const parseStream = incomingStream.pipe(csvparseStream);

    // csvparseStream.on('skip', () => {
    // });

    let isHeader = true;
    const codes: any = {};

    const CORRECT_NUMBER_OF_COLUMN = 4;
    const uploadWriteStream: NodeJS.WritableStream = new Writable({
        objectMode: true,
        write: async (line, _, next) => {
            if (isHeader) {
                if (line.length !== CORRECT_NUMBER_OF_COLUMN) {
                    throw console.error('Line length not equal to 4.');

                }
                isHeader = false;
                next();
            } else {
                if (codes[line[1].toString()] === undefined) {
                    codes[line[1].toString()] = [];
                }
                codes[line[1].toString()].push({
                    code: parseInt(line[2], 10).toString(),
                    description: line[3].toString()
                });

                next();
            }
        }
    });

    uploadWriteStream.on('finish', async () => {
        //TODO
        /* check for subject Id duplicate */
    });

    parseStream.pipe(uploadWriteStream);
    return codes;
}

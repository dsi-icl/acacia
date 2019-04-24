import { Models, OpenStackSwiftObjectStore } from 'itmat-utils';
// import { UKBCurator } from 'ukb-curator';
import { Database } from '../database/database';
import { IJobEntry } from 'itmat-utils/dist/models/job';
import { UKBFieldInfoPlugin } from '../plugins/fieldInfoPlugin';
export class JobDispatcher {
    // private readonly ukbCurator: UKBCurator;

    constructor(private readonly db: Database, private readonly objStore: OpenStackSwiftObjectStore) { // tslint:disable-line
        // this.ukbCurator = new UKBCurator(
        //     db.collections!.jobs_collection,
        //     db.collections!.UKB_coding_collection,
        //     db.collections!.field_dictionary_collection,
        //     db.collections!.data_collection
        // );
        this.initialise = this.initialise.bind(this);
        this.dispatch = this.dispatch.bind(this);
    }

    public async initialise() {
        // await this.ukbCurator.updateUKBCodingAndFieldsMap();
    }

    public async dispatch(job: IJobEntry<any>) {
        switch (job.jobType) {
            case Models.JobModels.jobTypes.UKB_CSV_UPLOAD.name:
                {
                    //const fileStream: NodeJS.ReadableStream = await this.objStore.downloadFile(job.receivedFiles[0], job.id);
                    //await this.ukbCurator.uploadIncomingCSVStreamToMongo(
                    //    job.study,
                    //    job.id,
                    //    job.receivedFiles,
                    //    fileStream
                    //);
                    //await this.db.jobs_collection!.updateOne({ id: job.id }, { $set: { status: 'finished' } });
                }
                break;
            case Models.JobModels.jobTypes.UKB_IMAGE_UPLOAD.name:
                {
                    const fileStream: NodeJS.ReadableStream = await this.objStore.downloadFile(job.receivedFiles[0], job.id);
                    // TO_DO:
                }
                break;
            case Models.JobModels.jobTypes.UKB_FIELD_INFO_UPLOAD.name:
                {
                    const fileStream: NodeJS.ReadableStream = await this.objStore.downloadFile(job.receivedFiles[0], job.id);
                    const ukbfieldprocessor = new UKBFieldInfoPlugin(job.id, job.studyId);
                    ukbfieldprocessor.setDBClient(this.db.db).setInputStream(fileStream).setTargetCollection('FIELD_COLLECTION');
                    await ukbfieldprocessor.processInputStreamToFieldEntry();
                }
                break;

        }
    }
}
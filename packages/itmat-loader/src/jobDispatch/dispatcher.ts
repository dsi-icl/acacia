import { Models, OpenStackSwiftObjectStore } from 'itmat-utils';
import { UKBCurator } from 'ukb-curator';
import { Database } from '../database/database';
import { IJobEntry } from 'itmat-utils/dist/models/job';
export class JobDispatcher {
    private readonly ukbCurator: UKBCurator;

    constructor(private readonly db: Database, private readonly objStore: OpenStackSwiftObjectStore) { // tslint:disable-line
        this.ukbCurator = new UKBCurator(
            db.UKB_field_dictionary_collection!,
            db.UKB_coding_collection!,
            db.jobs_collection!,
            db.data_collection!
        );
        this.initialise = this.initialise.bind(this);
        this.dispatch = this.dispatch.bind(this);
    }

    public async initialise() {
        await this.ukbCurator.updateUKBCodingAndFieldsMap();
    }

    public async dispatch(job: IJobEntry<any>) {
        switch (job.jobType) {
            case Models.JobModels.jobTypes.UKB_CSV_UPLOAD.name:
                {
                    const fileStream: NodeJS.ReadableStream = await this.objStore.downloadFile(job.receivedFiles, job.id);
                    await this.ukbCurator.uploadIncomingCSVStreamToMongo(
                        job.study,
                        job.id,
                        job.receivedFiles,
                        fileStream
                    );
                    await this.db.jobs_collection!.updateOne({ id: job.id }, { $set: { status: 'finished' } });
                }
                break;
            case Models.JobModels.jobTypes.UKB_IMAGE_UPLOAD.name:
                {
                    const fileStream: NodeJS.ReadableStream = await this.objStore.downloadFile(job.receivedFiles, job.id);
                    await this.ukbCurator.uploadIncomingCSVStreamToMongo(
                        job.study,
                        job.id,
                        job.receivedFiles,
                        fileStream
                    );
                    await this.db.jobs_collection!.updateOne({ id: job.id }, { $set: { status: 'finished' } });
                }
                break;
        }
    }
}
import { Models } from 'itmat-utils';
import { UKBCurator } from 'ukb-curator';
import { Database } from '../database/database';
import { IJobEntry } from 'itmat-utils/dist/models/job';
export class JobDispatcher {
    private readonly ukbCurator: UKBCurator;

    constructor(private readonly db: Database) {
        this.ukbCurator = new UKBCurator(
            db.UKB_field_dictionary_collection!,
            db.UKB_coding_collection!,
            db.jobs_collection!,
            db.data_collection!
        );
    }

    public dispatch(job: IJobEntry<any>) {
        switch (job.jobType) {
            case Models.JobModels.jobTypes.UKB_CSV_UPLOAD.name:
                job.
                this.ukbCurator.
                break;
            case Models.JobModels.jobTypes.UKB_IMAGE_UPLOAD.name:
                break;
        }
    }
}
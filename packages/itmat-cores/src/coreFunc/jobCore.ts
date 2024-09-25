import { CoreError, IJobEntry, enumCoreErrors } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
enum JOB_TYPE {
    QUERY_EXECUTION = 'QUERY_EXECUTION',
    DATA_EXPORT = 'DATA_EXPORT'
}

export class JobCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    public async createJob(): Promise<IJobEntry> {
        throw new CoreError(
            enumCoreErrors.NOT_IMPLEMENTED,
            enumCoreErrors.NOT_IMPLEMENTED
        );
    }
}

import { IJobEntry, IJobEntryForQueryCuration, IUserWithoutToken } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { DBType } from '../database/database';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../utils/errors';
import { PermissionCore } from './permissionCore';
import { StudyCore } from './studyCore';
import { ObjectStore } from '@itmat-broker/itmat-commons';

enum JOB_TYPE {
    QUERY_EXECUTION = 'QUERY_EXECUTION',
    DATA_EXPORT = 'DATA_EXPORT'
}

export class JobCore {
    db: DBType;
    permissionCore: PermissionCore;
    studyCore: StudyCore;
    constructor(db: DBType, objStore: ObjectStore) {
        this.db = db;
        this.permissionCore = new PermissionCore(db);
        this.studyCore = new StudyCore(db, objStore);
    }

    public async createJob(userId: string, jobType: string, files: string[], studyId: string, projectId?: string, jobId?: string): Promise<IJobEntry> {
        const job: IJobEntry = {
            requester: userId,
            id: jobId || uuid(),
            studyId,
            jobType,
            projectId,
            requestTime: new Date().valueOf(),
            receivedFiles: files,
            status: 'QUEUED',
            error: null,
            cancelled: false
        };
        await this.db.collections.jobs_collection.insertOne(job);
        return job;
    }

    public async createQueryCurationJob(requester: IUserWithoutToken | undefined, queryId: string[], studyId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        /* check study exists */
        await this.studyCore.findOneStudy_throwErrorIfNotExist(studyId);


        /* check if the query exists */
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const queryExist = await this.db.collections.queries_collection.findOne({ id: queryId[0] });
        if (!queryExist) {
            throw new GraphQLError('Query does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }

        const job: IJobEntryForQueryCuration = {
            id: uuid(),
            jobType: JOB_TYPE.QUERY_EXECUTION,
            studyId: studyId,
            requester: requester.id,
            requestTime: new Date().valueOf(),
            receivedFiles: [],
            error: null,
            status: 'QUEUED',
            cancelled: false,
            data: {
                queryId: queryId,
                studyId: studyId
            }
        };
        const result = await this.db.collections.jobs_collection.insertOne(job);
        if (!result.acknowledged) {
            throw new GraphQLError(errorCodes.DATABASE_ERROR);
        }
        return job;
    }
}

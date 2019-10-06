import { ApolloError } from 'apollo-server-core';
import { IJobEntry } from 'itmat-utils/dist/models/job';
import { IUser } from 'itmat-utils/dist/models/user';
import uuidv4 from 'uuid/v4';
import { db } from '../../database/database';
import { errorCodes } from '../errors';

export class ExportCore {

    public async createExportJob(studyId: string, requester: IUser, projectId?: string): Promise<IJobEntry<undefined>> {

        const exportjob: IJobEntry<undefined> = {
            jobType: 'EXPORT',
            id: uuidv4(),
            projectId,
            studyId,
            requester: requester.id,
            requestTime: new Date().valueOf(),
            receivedFiles: [],
            status: 'WAITING',
            error: null,
            cancelled: false
        };
        const result = await db.collections!.jobs_collection.insertOne(exportjob);
        if (result.result.ok === 1) {
            return exportjob;
        } else {
            throw new ApolloError('Cannot create export job', errorCodes.DATABASE_ERROR);
        }
    }

}

export const exportCore = Object.freeze(new ExportCore());

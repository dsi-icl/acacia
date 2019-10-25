import { ApolloError } from 'apollo-server-express';
import { Models } from 'itmat-commons';
import { IJobEntry } from 'itmat-commons/dist/models/job';
import uuid from 'uuid/v4';
import { db } from '../../database/database';
import { errorCodes } from '../errors';

enum JOB_TYPE {
    FIELD_INFO_UPLOAD = 'FIELD_INFO_UPLOAD',
    DATA_UPLOAD = 'DATA_UPLOAD',
    DATA_EXPORT = 'DATA_EXPORT'
}

export const jobResolvers = {
    Query: {},
    Mutation: {
        createDataCurationJob: async (parent: object, args: { file: string, studyId: string, tag?: string, version: string }, context: any, info: any): Promise<IJobEntry<{ dataVersion: string, versionTag?: string }>> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */

            /* check if the file exists */

            /* check study exists */

            /* check version format */
            if (!/^\d{1,3}(\.\d{1,2}){0,2}$/.test(args.version)) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }

            /* create job */
            const job: IJobEntry<{ dataVersion: string, versionTag?: string }> = {
                id: uuid(),
                jobType: JOB_TYPE.DATA_UPLOAD,
                studyId: args.studyId,
                requester: requester.id,
                requestTime: new Date().valueOf(),
                receivedFiles: [args.file],
                error: null,
                status: 'QUEUED',
                cancelled: false,
                data: {
                    dataVersion: args.version,
                    versionTag: args.tag
                }
            };

            const result = await db.collections!.jobs_collection.insertOne(job);
            if (result.result.ok !== 1) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
            return job;
        },
        createFieldCurationJob: async (parent: object, args: { file: string, studyId: string, tag: string, dataVersionId: string }, context: any, info: any): Promise<IJobEntry<{ dataVersionId: string, tag: string }>> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */

            /* check if the file exists */

            /* check study exists */

            /* create job */
            const job: IJobEntry<{ dataVersionId: string, tag: string }> = {
                id: uuid(),
                jobType: JOB_TYPE.FIELD_INFO_UPLOAD,
                studyId: args.studyId,
                requester: requester.id,
                requestTime: new Date().valueOf(),
                receivedFiles: [args.file],
                error: null,
                status: 'QUEUED',
                cancelled: false,
                data: {
                    dataVersionId: args.dataVersionId,
                    tag: args.tag
                }
            };

            const result = await db.collections!.jobs_collection.insertOne(job);
            if (result.result.ok !== 1) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
            return job;
        },
        createDataExportJob: async (parent: object, args: { studyId: string, projectId?: string }, context: any, info: any): Promise<IJobEntry<undefined>> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */

            /* check study exists */

            /* create job */
            const job: IJobEntry<undefined> = {
                id: uuid(),
                jobType: JOB_TYPE.DATA_EXPORT,
                studyId: args.studyId,
                requester: requester.id,
                projectId: args.projectId,
                requestTime: new Date().valueOf(),
                receivedFiles: [],
                error: null,
                status: 'QUEUED',
                cancelled: false
            };

            const result = await db.collections!.jobs_collection.insertOne(job);
            if (result.result.ok !== 1) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
            return job;
        }
    },
    Subscription: {}
};

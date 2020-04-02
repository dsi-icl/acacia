import { ApolloError, withFilter } from 'apollo-server-express';
import { Models } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';
import { pubsub, subscriptionEvents } from '../pubsub';

enum JOB_TYPE {
    FIELD_INFO_UPLOAD = 'FIELD_INFO_UPLOAD',
    DATA_UPLOAD = 'DATA_UPLOAD',
    DATA_EXPORT = 'DATA_EXPORT'
}

export const jobResolvers = {
    Query: {},
    Mutation: {
        createDataCurationJob: async (parent: object, args: { file: string, studyId: string, tag?: string, version: string }, context: any, info: any): Promise<Models.JobModels.IJobEntryForDataCuration> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */

            /* check if the file exists */

            /* check study exists */

            /* check version format */
            if (!/^\d{1,3}(\.\d{1,2}){0,2}$/.test(args.version)) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }

            /* create job */
            const job: Models.JobModels.IJobEntryForDataCuration = {
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
        createFieldCurationJob: async (parent: object, args: { file: string, studyId: string, tag: string, dataVersionId: string }, context: any, info: any): Promise<Models.JobModels.IJobEntryForFieldCuration> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */

            /* check if the file exists */

            /* check study exists */

            /* create job */
            const job: Models.JobModels.IJobEntryForFieldCuration = {
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
        }
    },
    Subscription: {
        subscribeToJobStatusChange: {
            subscribe: withFilter(
                () => pubsub.asyncIterator(subscriptionEvents.JOB_STATUS_CHANGE),
                (incoming, variables) => incoming.subscribeToJobStatusChange.studyId === variables.studyId
            )
        }
    }
};

import { Models, Logger } from 'itmat-utils';
import { Database, db } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter } from 'apollo-server-express';
import { IStudy } from 'itmat-utils/dist/models/study';
import { makeGenericReponse, IGenericResponse } from '../responses';
import { IQueryEntry } from 'itmat-utils/dist/models/query';
import uuid from 'uuid/v4';
import mongodb from 'mongodb';
import { pubsub, subscriptionEvents } from '../pubsub';
import { queryCore } from '../core/queryCore';
import { IFile } from 'itmat-utils/dist/models/file';
import { objStore } from '../../objStore/objStore';
import { errorCodes } from '../errors';
import { IJobEntry } from 'itmat-utils/dist/models/job';
import { ClientRequestArgs } from 'http';

enum JOB_TYPE {
    FIELD_INFO_UPLOAD = 'FIELD_INFO_UPLOAD',
    DATA_UPLOAD = 'DATA_UPLOAD'
}

export const jobResolvers = {
    Query: {},
    Mutation: {
        createDataCurationJob: async(parent: object, args: { file: string, studyId: string, jobType: JOB_TYPE, tag?: string, version: string }, context: any, info: any): Promise<IJobEntry<{ dataVersion: string, versionTag?: string }>> => {
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
                jobType: args.jobType,
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
        createFieldCurationJob: async(parent: object, args: { file: string, studyId: string, tag: string, dataVersionId: string }, context: any, info: any): Promise<IJobEntry<{ dataVersionId: string, tag: string }>> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */

            /* check if the file exists */

            /* check study exists */

            /* create job */
            const job: IJobEntry<{ dataVersionId: string, tag: string }> = {
                id: uuid(),
                jobType: 'FIELD_ANNOTATION_UPLOAD',
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
    Subscription: {}
};
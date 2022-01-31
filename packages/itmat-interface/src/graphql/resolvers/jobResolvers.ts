import { ApolloError } from 'apollo-server-express';
import { withFilter } from 'graphql-subscriptions';
import { Models, task_required_permissions } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';
import { pubsub, subscriptionEvents } from '../pubsub';
import { permissionCore } from '../core/permissionCore';
import { studyCore } from '../core/studyCore';

enum JOB_TYPE {
    FIELD_INFO_UPLOAD = 'FIELD_INFO_UPLOAD',
    DATA_UPLOAD_CSV = 'DATA_UPLOAD_CSV',
    DATA_UPLOAD_JSON = 'DATA_UPLOAD_JSON',
    QUERY_EXECUTION = 'QUERY_EXECUTION',
    DATA_EXPORT = 'DATA_EXPORT'
}

export const jobResolvers = {
    Query: {},
    Mutation: {
        createDataCurationJob: async (__unused__parent: Record<string, unknown>, args: { file: string[], studyId: string }, context: any): Promise<Models.JobModels.IJobEntryForDataCuration[]> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const dataFormatToJobType = {
                json: JOB_TYPE.DATA_UPLOAD_JSON,
                csv: JOB_TYPE.DATA_UPLOAD_CSV
                // tsv: JOB_TYPE.DATA_UPLOAD_CSV
            };

            const jobList: Models.JobModels.IJobEntryForDataCuration[] = [];
            for (const oneFile of args.file) {
                /* check if the file exists */
                const file = await db.collections!.files_collection.findOne({ deleted: null, id: oneFile });
                if (!file) {
                    throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                }

                /* check study exists */
                await studyCore.findOneStudy_throwErrorIfNotExist(args.studyId);

                /* create job */
                const parts = file.fileName.split('.');
                const dataFormat = parts[parts.length - 1];

                if (!dataFormatToJobType[dataFormat]) {
                    throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                }
                const job: Models.JobModels.IJobEntryForDataCuration = {
                    id: uuid(),
                    jobType: dataFormatToJobType[dataFormat],
                    studyId: args.studyId,
                    requester: requester.id,
                    requestTime: new Date().valueOf(),
                    receivedFiles: [oneFile],
                    error: null,
                    status: 'QUEUED',
                    cancelled: false,
                };

                const result = await db.collections!.jobs_collection.insertOne(job);
                jobList.push(job);
                if (!result.acknowledged) {
                    throw new ApolloError(errorCodes.DATABASE_ERROR);
                }
            }
            return jobList;
        },
        createFieldCurationJob: async (__unused__parent: Record<string, unknown>, args: { file: string, studyId: string, tag: string }, context: any): Promise<Models.JobModels.IJobEntryForFieldCuration> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            /* check if the file exists */
            const file = await db.collections!.files_collection.findOne({ deleted: null, id: args.file });
            if (!file) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* check study exists */
            await studyCore.findOneStudy_throwErrorIfNotExist(args.studyId);

            /* check tag not undefined */
            if (args.tag === undefined) {
                throw new ApolloError('Tag is not provided', errorCodes.CLIENT_MALFORMED_INPUT);
            }

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
                    tag: args.tag
                }
            };

            const result = await db.collections!.jobs_collection.insertOne(job);
            if (!result.acknowledged) {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
            return job;
        },
        createQueryCurationJob: async (__unused__parent: Record<string, unknown>, args: { queryId: string[], studyId: string, projectId: string }, context: any): Promise<Models.JobModels.IJobEntryForQueryCuration> => {
            const requester: Models.UserModels.IUser = context.req.user;

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.access_project_data,
                requester,
                args.studyId,
                args.projectId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            /* check study exists */
            await studyCore.findOneStudy_throwErrorIfNotExist(args.studyId);

            /* check if project exists */
            const projectExist = await db.collections!.projects_collection.findOne({ id: args.projectId });
            if (!projectExist) {
                throw new ApolloError('Project does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* check if the query exists */
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const queryExist = await db.collections!.queries_collection.findOne({ id: args.queryId[0] });
            if (!queryExist) {
                throw new ApolloError('Query does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            const job: Models.JobModels.IJobEntryForQueryCuration = {
                id: uuid(),
                jobType: JOB_TYPE.QUERY_EXECUTION,
                studyId: args.studyId,
                requester: requester.id,
                requestTime: new Date().valueOf(),
                receivedFiles: [],
                error: null,
                status: 'QUEUED',
                cancelled: false,
                data: {
                    queryId: args.queryId,
                    projectId: args.projectId,
                    studyId: args.studyId
                }
            };
            const result = await db.collections!.jobs_collection.insertOne(job);
            if (!result.acknowledged) {
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

import { GraphQLError } from 'graphql';
import { withFilter } from 'graphql-subscriptions';
import { task_required_permissions, IJobEntryForDataCuration, IJobEntryForFieldCuration, IJobEntryForQueryCuration, IUser } from '@itmat-broker/itmat-types';
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
        createDataCurationJob: async (__unused__parent: Record<string, unknown>, args: { file: string[], studyId: string }, context: any): Promise<IJobEntryForDataCuration[]> => {
            const requester: IUser = context.req.user;

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            const dataFormatToJobType = {
                json: JOB_TYPE.DATA_UPLOAD_JSON,
                csv: JOB_TYPE.DATA_UPLOAD_CSV
                // tsv: JOB_TYPE.DATA_UPLOAD_CSV
            };

            const jobList: IJobEntryForDataCuration[] = [];
            for (const oneFile of args.file) {
                /* check if the file exists */
                const file = await db.collections!.files_collection.findOne({ deleted: null, id: oneFile });
                if (!file) {
                    throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                }

                /* check study exists */
                await studyCore.findOneStudy_throwErrorIfNotExist(args.studyId);

                /* create job */
                const parts = file.fileName.split('.');
                const dataFormat = parts[parts.length - 1] as keyof typeof dataFormatToJobType;

                if (!dataFormatToJobType[dataFormat]) {
                    throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
                }
                const job: IJobEntryForDataCuration = {
                    id: uuid(),
                    jobType: dataFormatToJobType[dataFormat],
                    studyId: args.studyId,
                    requester: requester.id,
                    requestTime: new Date().valueOf(),
                    receivedFiles: [oneFile],
                    error: null,
                    status: 'QUEUED',
                    cancelled: false
                };

                const result = await db.collections!.jobs_collection.insertOne(job);
                jobList.push(job);
                if (!result.acknowledged) {
                    throw new GraphQLError(errorCodes.DATABASE_ERROR);
                }
            }
            return jobList;
        },
        createFieldCurationJob: async (__unused__parent: Record<string, unknown>, args: { file: string, studyId: string, tag: string }, context: any): Promise<IJobEntryForFieldCuration> => {
            const requester: IUser = context.req.user;

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                args.studyId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            /* check if the file exists */
            const file = await db.collections!.files_collection.findOne({ deleted: null, id: args.file });
            if (!file) {
                throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* check study exists */
            await studyCore.findOneStudy_throwErrorIfNotExist(args.studyId);

            /* check tag not undefined */
            if (args.tag === undefined) {
                throw new GraphQLError('Tag is not provided', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
            }

            /* create job */
            const job: IJobEntryForFieldCuration = {
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
                throw new GraphQLError(errorCodes.DATABASE_ERROR);
            }
            return job;
        },
        createQueryCurationJob: async (__unused__parent: Record<string, unknown>, args: { queryId: string[], studyId: string, projectId: string }, context: any): Promise<IJobEntryForQueryCuration> => {
            const requester: IUser = context.req.user;

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.access_project_data,
                requester,
                args.studyId,
                args.projectId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            /* check study exists */
            await studyCore.findOneStudy_throwErrorIfNotExist(args.studyId);

            /* check if project exists */
            const projectExist = await db.collections!.projects_collection.findOne({ id: args.projectId });
            if (!projectExist) {
                throw new GraphQLError('Project does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
            }

            /* check if the query exists */
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const queryExist = await db.collections!.queries_collection.findOne({ id: args.queryId[0] });
            if (!queryExist) {
                throw new GraphQLError('Query does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
            }

            const job: IJobEntryForQueryCuration = {
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
                throw new GraphQLError(errorCodes.DATABASE_ERROR);
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

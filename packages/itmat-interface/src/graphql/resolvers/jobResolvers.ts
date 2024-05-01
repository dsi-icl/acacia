import { GraphQLError } from 'graphql';
import { withFilter } from 'graphql-subscriptions';
import { IJobEntryForQueryCuration, atomicOperation, IPermissionManagementOptions } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';
import { pubsub, subscriptionEvents } from '../pubsub';
import { permissionCore } from '../core/permissionCore';
import { studyCore } from '../core/studyCore';
import { DMPResolversMap } from './context';

enum JOB_TYPE {
    FIELD_INFO_UPLOAD = 'FIELD_INFO_UPLOAD',
    DATA_UPLOAD_CSV = 'DATA_UPLOAD_CSV',
    DATA_UPLOAD_JSON = 'DATA_UPLOAD_JSON',
    QUERY_EXECUTION = 'QUERY_EXECUTION',
    DATA_EXPORT = 'DATA_EXPORT'
}

export const jobResolvers: DMPResolversMap = {
    Query: {},
    Mutation: {
        createQueryCurationJob: async (parent, args: { queryId: string[], studyId: string, projectId: string }, context) => {
            const requester = context.req.user;
            if (!requester) {
                throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            /* check permission */
            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.job,
                atomicOperation.WRITE,
                requester,
                args.studyId
            );
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.job,
                atomicOperation.WRITE,
                requester,
                args.studyId,
                args.projectId
            );
            if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            /* check study exists */
            await studyCore.findOneStudy_throwErrorIfNotExist(args.studyId);

            /* check if project exists */
            const projectExist = await db.collections.projects_collection.findOne({ id: args.projectId });
            if (!projectExist) {
                throw new GraphQLError('Project does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
            }

            /* check if the query exists */
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const queryExist = await db.collections.queries_collection.findOne({ id: args.queryId[0] });
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
            const result = await db.collections.jobs_collection.insertOne(job);
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

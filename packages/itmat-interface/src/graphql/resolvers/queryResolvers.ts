import { permissions, IQueryEntry, IUser, IProject } from '@itmat-broker/itmat-types';
import { queryCore } from '../core/queryCore';
import { permissionCore } from '../core/permissionCore';
import { ApolloError } from 'apollo-server-express';
import { errorCodes } from '../errors';
import { db } from '../../database/database';

export const queryResolvers = {
    Query: {
        getQueryById: async (__unused__parent: Record<string, unknown>, args: { queryId: string }, context: any): Promise<IQueryEntry> => {
            const queryId = args.queryId;
            const requester: IUser = context.req.user;
            /* check query exists */
            const queryEntry = await db.collections!.queries_collection.findOne({ id: queryId }, { projection: { _id: 0, claimedBy: 0 } });
            if (queryEntry === null || queryEntry === undefined) {
                throw new ApolloError('Query does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            /* check permission */
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_project.specific_project_readonly_access],
                requester,
                queryEntry.studyId,
                queryEntry.projectId
            );

            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                queryEntry.studyId
            );
            if (!hasProjectLevelPermission && !hasStudyLevelPermission) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }
            return queryEntry;
        },
        getQueries: async (__unused__parent: Record<string, unknown>, args: { studyId: string, projectId: string }, context: any): Promise<IQueryEntry[]> => {
            const requester: IUser = context.req.user;

            /* check permission */
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_project.specific_project_readonly_access],
                requester,
                args.studyId,
                args.projectId
            );

            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                args.studyId
            );
            if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }
            const entries = await db.collections!.queries_collection.find({ studyId: args.studyId, projectId: args.projectId }).toArray();
            return entries;
        }
    },
    Mutation: {
        createQuery: async (__unused__parent: Record<string, unknown>, args: { query: { userId: string, queryString: any, studyId: string, projectId?: string } }): Promise<IQueryEntry> => {
            /* check study exists */
            const studySearchResult = await db.collections!.studies_collection.findOne({ id: args.query.studyId, deleted: null });
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new ApolloError('Study does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            /* check project exists */
            const project = await db.collections!.projects_collection.findOne<Omit<IProject, 'patientMapping'>>({ id: args.query.projectId, deleted: null }, { projection: { patientMapping: 0 } })!;
            if (project === null) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            /* check project matches study */
            if (studySearchResult.id !== project.studyId) {
                throw new ApolloError('Study and project mismatch.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            const entry = await queryCore.createQuery(args);
            return entry;
        }
    },
    Subscription: {}
};

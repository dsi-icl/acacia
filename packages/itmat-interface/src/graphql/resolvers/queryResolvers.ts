import { IQueryEntry } from 'itmat-commons';
import { queryCore } from '../core/queryCore';

export const queryResolvers = {
    Query: {
        getQueryById: async (__unused__parent: Record<string, unknown>, args: { queryId: string }): Promise<IQueryEntry> => {
            const queryId = args.queryId;
            /* check permission */

            /* check if the client wants the result */
            const entry = await queryCore.getOneQuery_throwErrorIfNotExists(queryId, false);
            return entry;
        },
        getQueries: async (__unused__parent: Record<string, unknown>, args: { studyId: string, projectId: string }): Promise<IQueryEntry[]> => {
            /* check permission */

            const entries = await queryCore.getQueries(args.studyId, args.projectId);
            return entries;
        }
    },
    Mutation: {
        createQuery: async (__unused__parent: Record<string, unknown>, args: {userId: string, queryString: string, studyId: string, projectId?: string}): Promise<IQueryEntry> => {
            const entry = await queryCore.createQuery(args);
            return entry;
        }
    },
    Subscription: {}
};

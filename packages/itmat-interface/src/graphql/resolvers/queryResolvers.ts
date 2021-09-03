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
        }
    },
    Mutation: {},
    Subscription: {}
};

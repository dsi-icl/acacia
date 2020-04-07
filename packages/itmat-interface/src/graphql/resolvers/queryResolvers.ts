import { IQueryEntry } from '@itmat/commons';
import { queryCore } from '../core/queryCore';


export const queryResolvers = {
    Query: {
        // getQueries: async(parent: object, args: { studyId: string, projectId: string }, context: any, info: any): Promise<IQueryEntry[]> => {

        // },

        getQueryById: async (parent: object, args: { queryId: string }, context: any, info: any): Promise<IQueryEntry> => {
            const queryId = args.queryId;
            /* check permission */

            /* check if the client wants the result */
            const entry = await queryCore.getOneQuery_throwErrorIfNotExists(queryId, false);
            return entry;


        }
    },
    Mutation: {
        // createQuery: async(parent: object, args: { queryString: string, returnFieldSelection?: string[], study: string, project?: string }, context: any, info: any): Promise<IQueryEntry> => {
        //     const query = queryCore.createQuery()
        // }
    },
    Subscription: {}
};

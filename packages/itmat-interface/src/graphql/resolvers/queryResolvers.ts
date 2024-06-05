import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { QueryCore } from '@itmat-broker/itmat-cores';

const queryCore = Object.freeze(new QueryCore(db));

export const queryResolvers: DMPResolversMap = {
    Query: {
        getQueryById: async (_parent, args: { queryId: string }, context) => {
            return await queryCore.getQueryByIdparent(context.req.user, args.queryId);
        },
        getQueries: async (_parent, args: { studyId: string, projectId: string }, context) => {
            return queryCore.getQueries(context.req.user, args.studyId, args.projectId);
        }
    },
    Mutation: {
        createQuery: async (_parent, args: { query: { userId: string, queryString, studyId: string, projectId?: string } }) => {
            return queryCore.createQuery(args.query.userId, args.query.queryString, args.query.studyId, args.query.projectId);
        }
    },
    Subscription: {}
};

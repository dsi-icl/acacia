import { withFilter } from 'graphql-subscriptions';
import { pubsub } from '../pubsub';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { JobCore, subscriptionEvents } from '@itmat-broker/itmat-cores';
import { objStore } from '../../objStore/objStore';

const jobCore = Object.freeze(new JobCore(db, objStore));

export const jobResolvers: DMPResolversMap = {
    Query: {},
    Mutation: {
        createQueryCurationJob: async (_parent, { queryId, studyId }: { queryId: string[], studyId: string }, context) => {
            return await jobCore.createQueryCurationJob(context.req.user, queryId, studyId);
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

import { withFilter } from 'graphql-subscriptions';
import { pubsub } from '../pubsub';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { TRPCJobCore, subscriptionEvents } from '@itmat-broker/itmat-cores';

// TODO: Implement the jobResolvers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const jobCore = new TRPCJobCore(db);

export const jobResolvers: DMPResolversMap = {
    Query: {},
    Mutation: {
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

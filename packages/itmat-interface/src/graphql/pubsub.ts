import { PubSub } from 'graphql-subscriptions';

export const pubsub = new PubSub();

export const subscriptionEvents = {
    JOB_STATUS_CHANGE: 'JOB_STATUS_CHANGE',
    NEW_JOB: 'NEW_JOB'
};

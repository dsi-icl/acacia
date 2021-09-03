import { PubSub } from 'apollo-server-express';

export const pubsub = new PubSub();

export const subscriptionEvents = {
    JOB_STATUS_CHANGE: 'JOB_STATUS_CHANGE',
    NEW_JOB: 'NEW_JOB'
};

import { PubSub } from 'apollo-server-express';

export const pubsub = new PubSub();

export const subscriptionEvents = {
    study: {
        NEW_APPLICATION_CREATED: 'NEW_APPLICATION_CREATED',
        APPLICATION_DELETED: 'APPLICATION_DELETED',
        APPLICATION_EDITED: 'APPLICATION_EDITED',
        USER_LIST_CHANGED: 'USER_LIST_CHANGED'
    },
    query: {
        QUERY_STATUS_UPDATE: 'QUERY_STATUS_UPDATE'
    }
};
import { PubSub } from 'apollo-server-express';

export const pubsub = new PubSub();

export const subscriptionEvents = {
    users: {
        NEW_USER_CREATED: 'NEW_USER_CREATED',
        USER_EDITED: 'USER_EDITED',
        USER_DELETED: 'USER_DELETED'
    },
    studies: {
        NEW_STUDY_CREATED: 'NEW_STUDY_CREATED',
        STUDY_EDITED: 'STUDY_EDITED',
        STUDY_DELETED: 'STUDY_DELETED'
    },
    application: {
        NEW_APPLICATION_CREATED: 'NEW_APPLICATION_CREATED'
    }
};
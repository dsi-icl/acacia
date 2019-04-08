import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter } from 'apollo-server-express';
import { IStudy } from 'itmat-utils/dist/models/study';
import { makeGenericReponse } from '../responses';
import { IQueryEntry } from 'itmat-utils/dist/models/query';
import uuid from 'uuid/v4';
import mongodb from 'mongodb';
import { pubsub, subscriptionEvents } from '../pubsub';


export const queryResolvers = {
    Query: {
        getQueries: async(parent: object, args: any, context: any, info: any): Promise<void> => {
        }
    },
    Mutation: {
        createQuery: async(parent: object, args: any, context: any, info: any): Promise<void> => {

        }
    },
    Subscription: {}
};
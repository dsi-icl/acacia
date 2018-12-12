import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError } from 'apollo-server-express';
import { InsertOneWriteOpResult, Db } from 'itmat-utils/node_modules/@types/mongodb';
import { IStudy } from 'itmat-utils/dist/models/study';
import { makeGenericReponse } from '../responses';

export const queryResolvers = {
    Query: {
        getQuery: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy> => {
        }
    },
    Mutation: {
        createQuery: async(parent: object, args: any, context: any, info: any): Promise<> => {
        }
    }
};
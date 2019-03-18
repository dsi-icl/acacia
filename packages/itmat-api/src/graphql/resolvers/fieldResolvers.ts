import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter } from 'apollo-server-express';
import { IFieldEntry } from 'itmat-utils/dist/models/field';
import uuid from 'uuid/v4';
import mongodb from 'mongodb';


export const fieldResolvers = {
    Query: {
        getAvailableFields: async(parent: object, args: any, context: any, info: any): Promise<IFieldEntry[]> => {
            const db: Database = context.db;
            const studyCollection = db.studies_collection!;
            const fieldCollection = db.field_dictionary_collection!;
            const requester: Models.UserModels.IUser = context.req.user;
            const { study, application } = args; 

            const studySearchResult: Models.Study.IStudy = await studyCollection.findOne({ name: study, deleted: false })!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new UserInputError('Study does not exist.');
            }

            let queryObj: any = { study };
            console.log('application', application);
            if ( !(application === undefined || application === null) ) {
                const applicationsFiltered = studySearchResult.applications.filter(el => el.name === application);
                if (applicationsFiltered.length !== 1) {
                    throw new UserInputError('Application does not exist.');
                }
                const approvedFields = applicationsFiltered[0].approvedFields;
                queryObj = { study, FieldID: { $in: approvedFields } };
            }

            const cursor = fieldCollection.find(queryObj, { projection: { _id: 0 } });
            const result = await cursor.toArray();
            return result;
        }
    },
    Mutation: {},
    Subscription: {}
};
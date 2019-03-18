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
        getQueries: async(parent: object, args: any, context: any, info: any): Promise<IQueryEntry[]> => {
            const db: Database = context.db;
            const collection = db.queries_collection!;
            const requester: Models.UserModels.IUser = context.req.user;
            const { id, study, application } = args;

            if (!(study && application) && !id) {
                throw new UserInputError('Provide "study and application" or "id" or both.');
            }

            const studySearchResult: Models.Study.IStudy = await db.studies_collection!.findOne({ name: study, deleted: false })!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new ApolloError('Study does not exist.');
            }

            const userIsManager = studySearchResult.studyAndDataManagers.includes(requester.username);

            const applications = studySearchResult.applications.filter(
                el =>
                    el.name === application &&
                        (
                            requester.type === Models.UserModels.userTypes.ADMIN ||
                            userIsManager ||
                            el.applicationAdmins.includes(requester.username) ||
                            el.applicationUsers.includes(requester.username)
                        )
            );

            if (applications.length === 0) {
                throw new UserInputError('Application does not exist or you do not have access.');
            }

            const queryObj: any = {};
            for (let each of ['id', 'study', 'application']) {
                if (args[each]) {
                    queryObj[each] = args[each];
                }
            }

            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                queryObj.requester = requester.username;
            }

            const cursor = db.queries_collection!.find(queryObj, { projection: { _id: 0 } });
            const result = await cursor.toArray();
            return result;
        }
    },
    Mutation: {
        createQuery: async(parent: object, args: any, context: any, info: any): Promise<IQueryEntry> => {
            // TO_DO: validate query first
            const { queryString, returnFieldSelection, study, application } = args.query;
            if (false) { // query is malform
                throw new UserInputError('Malformed query.');
            }

            const db: Database = context.db;
            const collection = db.queries_collection!;
            const requester: Models.UserModels.IUser = context.req.user;

            const studySearchResult: Models.Study.IStudy = await db.studies_collection!.findOne({ name: study, deleted: false })!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new ApolloError('Study does not exist.');
            }
            
            const userIsManager = studySearchResult.studyAndDataManagers.includes(requester.username);

            const applications = studySearchResult.applications.filter(
                el =>
                    el.name === application &&
                        (
                            requester.type === Models.UserModels.userTypes.ADMIN ||
                            userIsManager ||
                            el.applicationAdmins.includes(requester.username) ||
                            el.applicationUsers.includes(requester.username)
                        )
            );

            if (applications.length === 0) {
                throw new UserInputError('Application does not exist or you do not have access.');
            }
            
            const queryEntry: IQueryEntry = {
                id: uuid(),
                queryString: queryString,
                study: study,
                application: application,
                requester: requester.username,
                status: 'QUEUED',
                error: null,
                cancelled: false
            };

            const result: mongodb.InsertOneWriteOpResult = await collection.insertOne(queryEntry);
            if (result.result.ok === 1) {
                return queryEntry;
            } else {
                throw new ApolloError('Internal error.');
            }
        }
    },
    Subscription: {}
    //     queryStatusUpdate: {
    //         subscribe: withFilter(
    //             () => pubsub.asyncIterator(subscriptionEvents.query.QUERY_STATUS_UPDATE),
    //             (payload, arg) => {
    //                 return payload.queryStatusUpdate.study === arg.study && payload.queryStatusUpdate.application === arg.application;
    //             }
    //         )
    //     }
    // }
};
import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError } from 'apollo-server-express';
import { InsertOneWriteOpResult, Db } from 'itmat-utils/node_modules/@types/mongodb';
import { IStudy } from 'itmat-utils/dist/models/study';

export const studyResolvers = {
    Query: {
        getStudies: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy[]> => {
            // 2 scenarios:
            // 1. user is sys admin -> user gets all studies / the one that he requests
            // 2. user is not sys admin -> user gets all studies he can access / the one he requests if he has access
            const db: Db = context.db;
            const collection = db.collection('STUDY_COLLECTION');
            const user: Models.UserModels.IUser = context.req.user;
            const queryObj: any = {};
            if (user.type !== Models.UserModels.userTypes.ADMIN) {
                queryObj.$or = [{ analysts: user.username }, { curators: user.username }];
            }
            if (args.name !== undefined) {
                queryObj.name = args.name;
            }

            const cursor = collection.find(queryObj, { projection: { _id: 0 }});
            return cursor.toArray();
        }
    },
    Mutation: {
        createStudy: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy> => {
            const db: Db = context.db;
            const user: Models.UserModels.IUser = context.req.user;
            if (user.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }
            const studyEntry: Models.Study.IStudy = {
                name: args.name,
                createdBy: user.username,
                dataAdmins: [],
                dataUsers: []
            };
            let result: InsertOneWriteOpResult;

            result = await db.collection('STUDY_COLLECTION').insertOne(studyEntry);
            if (result.insertedCount !== 1) {
                throw new ApolloError('Error in creating study. InsertedCount is not 1 although mongo operation does not throw error.');
            }
            return await db.collection('STUDY_COLLECTION').findOne({ _id: result.insertedId })!;
        },
        addUserToStudy: async(parent: object, args: any, context: any, info: any): Promise<null> => {
            const db: Db = context.db;
            const user: Models.UserModels.IUser = context.req.user;
            const { username: userToBeAdded, study, type }: { username: string, study: string, type: string } =  args;
            const studyQueryObj: any = { name: study };
            if (user.type !== Models.UserModels.userTypes.ADMIN) {
                studyQueryObj.$or = [{ analysts: user.username }, { curators: user.username }];
            }
            const studySearchResult: IStudy = await db.collection('STUDY_COLLECTION').findOne(studyQueryObj)!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new UserInputError('Study does not exist.');
            }
            const userSearchResult: Models.UserModels.IUser = await db.collection('test_users').findOne({ username: userToBeAdded })!;
            if (userSearchResult === null || userSearchResult === undefined) {
                throw new UserInputError('User does not exist.');
            }
            if (!studySearchResult.dataAdmins.includes(userToBeAdded) && user.type !== Models.UserModels.userTypes.ADMIN) {
                throw new UserInputError('Study does not exist.');
            }
            // TO_DO
        },
        deleteUserFromStudy: async(parent: object, args: any, context: any, info: any): Promise<null> => {
            const db: Db = context.db;
            const user: Models.UserModels.IUser = context.req.user;
        },
        deleteStudy: async(parent: object, args: any, context: any, info: any): Promise<null> => {
            const db: Db = context.db;
            const user: Models.UserModels.IUser = context.req.user;
        }
    }
};
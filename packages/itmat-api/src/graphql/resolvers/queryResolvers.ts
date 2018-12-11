import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError } from 'apollo-server-express';
import { InsertOneWriteOpResult, Db } from 'itmat-utils/node_modules/@types/mongodb';
import { IStudy } from 'itmat-utils/dist/models/study';

export const queryResolvers = {
    Query: {
    },
    Mutation: {
        createQuery: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy> => {
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
        }
    }
};
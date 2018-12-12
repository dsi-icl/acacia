import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError } from 'apollo-server-express';
import { InsertOneWriteOpResult, Db, UpdateWriteOpResult } from 'itmat-utils/node_modules/@types/mongodb';
import { IStudy } from 'itmat-utils/dist/models/study';
import { makeGenericReponse } from '../responses';
export const studyResolvers = {
    Query: {
        getStudies: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy[]> => {
            // 2 scenarios:
            // 1. user is sys admin -> user gets all studies / the one that he requests
            // 2. user is not sys admin -> user gets all studies he can access / the one he requests if he has access
            const db: Database = context.db;
            const collection = db.studies_collection!;
            const user: Models.UserModels.IUser = context.req.user;
            const queryObj: any = {};
            if (user.type !== Models.UserModels.userTypes.ADMIN) {
                queryObj.$or = [{ dataAdmins: user.username }, { dataUsers: user.username }];
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
            const db: Database = context.db;
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

            result = await db.studies_collection!.insertOne(studyEntry);
            if (result.insertedCount !== 1) {
                throw new ApolloError('Error in creating study. InsertedCount is not 1 although mongo operation does not throw error.');
            }
            return makeGenericReponse();
        },
        addUserToStudy: async(parent: object, args: any, context: any, info: any): Promise<void> => {
            const db: Database = context.db;
            const user: Models.UserModels.IUser = context.req.user;
            const { username: userToBeAdded, study, type }: { username: string, study: string, type: string } =  args;
            const studyQueryObj: any = { name: study };
            if (user.type !== Models.UserModels.userTypes.ADMIN) {
                studyQueryObj.$or = [{ dataAdmins: user.username }, { dataUsers: user.username }];
            }
            const studySearchResult: IStudy = await db.studies_collection!.findOne(studyQueryObj)!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new UserInputError('Study does not exist or you do not have authorisation.');
            }
            const userSearchResult: Models.UserModels.IUser = await db.users_collection!.findOne({ username: userToBeAdded, deleted: false })!;
            if (userSearchResult === null || userSearchResult === undefined) {
                throw new UserInputError('User does not exist.');
            }
            if (!studySearchResult.dataAdmins.includes(user.username) && user.type !== Models.UserModels.userTypes.ADMIN) {
                throw new UserInputError('Study does not exist or you do not have authorisation.');
            }

            const userIsDataAdmin = studySearchResult.dataAdmins.includes(userToBeAdded);
            const userIsDataUser = studySearchResult.dataUsers.includes(userToBeAdded);
            const typeToBeAddedIsAdmin = type === Models.Study.STUDY_USER_TYPE.dataAdmins;
            let updateObj: any;

            // doing these else-ifs to avoid having to do multiple updates
            if (userIsDataAdmin && userIsDataUser) {  // shouldn't be true at any time if data is integral. but just in case
                if (typeToBeAddedIsAdmin) {
                    updateObj = { $pull: { dataUsers: userToBeAdded } };
                } else {
                    updateObj = { $pull: { dataAdmins: userToBeAdded } };
                }
            } else if (userIsDataAdmin) {
                if (!typeToBeAddedIsAdmin) {
                    updateObj = { $pull: { dataAdmins: userToBeAdded }, $push: { dataUsers: userToBeAdded } };
                } else {
                    return makeGenericReponse();
                }
            } else if (userIsDataUser) {
                if (typeToBeAddedIsAdmin) {
                    updateObj = { $push: { dataAdmins: userToBeAdded }, $pull: { dataUsers: userToBeAdded } };
                } else {
                    return makeGenericReponse();
                }
            } else if (!userIsDataAdmin && !userIsDataAdmin) {
                if (typeToBeAddedIsAdmin) {
                    updateObj = { $push: { dataAdmins: userToBeAdded } };
                } else {
                    updateObj = { $push: { dataUsers: userToBeAdded } };
                }
            }

            const updateResult: UpdateWriteOpResult = await db.studies_collection!.updateOne(
                { name: study },
                updateObj
            );
            return makeGenericReponse();
        },
        deleteUserFromStudy: async(parent: object, args: any, context: any, info: any): Promise<void> => {
            const db: Database = context.db;
            const user: Models.UserModels.IUser = context.req.user;
            const { study, username: userToBeDeleted }: { study: string, username: string } = args;
            // check whether the user is in the study // if yes then delete

            const studySearchResult: IStudy = await db.studies_collection!.findOne({ name: study })!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new UserInputError('Study does not exist.');
            }

            if (!studySearchResult.dataAdmins.includes(userToBeDeleted) && !studySearchResult.dataUsers.includes(userToBeDeleted)) {
                return makeGenericReponse();
            }

            const updateResult: UpdateWriteOpResult = await db.studies_collection!.updateOne(
                { name: study },
                { $pull: { dataAdmins: userToBeDeleted, dataUsers: userToBeDeleted } }
            );
            return makeGenericReponse();
        },
        deleteStudy: async(parent: object, args: any, context: any, info: any): Promise<void> => {
            const db: Database = context.db;
            const user: Models.UserModels.IUser = context.req.user;
            // TO_DO: delete patients too?
        }
    }
};
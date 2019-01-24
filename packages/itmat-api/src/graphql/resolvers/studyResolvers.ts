import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError } from 'apollo-server-express';
import { InsertOneWriteOpResult, UpdateWriteOpResult, WriteOpResult } from 'itmat-utils/node_modules/@types/mongodb';
import { IStudy, APPLICATION_USER_TYPE, IApplication } from 'itmat-utils/dist/models/study';
import { makeGenericReponse } from '../responses';
import uuidv4 from 'uuid/v4';
import config from '../../../config/config.json';

export const studyResolvers = {
    Query: {
        getStudies: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy[]> => {
            const db: Database = context.db;
            const collection = db.studies_collection!;
            const requester: Models.UserModels.IUser = context.req.user;
            const requestedFields: string[] = info.fieldNodes[0].selectionSet.selections.map((el: any) => el.name.value);
            const queryObj: any = { deleted: false };
            const projectionObj: any = { _id: 0 };
            for (const each of requestedFields) {
                projectionObj[each] = 1;
            }
            console.log(requester);
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                queryObj.$or = [{ studyAndDataManagers: requester.username }, { 'applications.applicationAdmins': requester.username }, { 'applications.applicationUsers': requester.username }];
                if (requestedFields.includes('applications')) {
                    projectionObj.applications = { $filter: {
                            input: '$applications',
                            as: 'application',
                            cond: { $or: [{ applicationAdmins: requester.username }, { applicationUsers: requester.username }] }
                        }
                    };  // TO_DO: bug?
                }
            }
            if (args.name !== undefined) {
                queryObj.name = args.name;
            }

            let aggregatePipeline: any;
            if (requestedFields.includes('jobs')) {
                aggregatePipeline = [
                    { $match: queryObj },
                    {
                        $lookup: {
                            from: config.database.collections.jobs_collection,
                            localField: 'name',
                            foreignField: 'study',
                            as: 'jobs'
                        }
                    },
                    { $project: projectionObj}
                ];
            } else {
                aggregatePipeline = [
                    { $match: queryObj },
                    { $project: projectionObj}
                ];
            }
            console.log(aggregatePipeline);
            const cursor = collection.aggregate(aggregatePipeline);
            return cursor.toArray();
        }
    },
    Mutation: {
        createStudy: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }
            const studyEntry: Models.Study.IStudy = {
                id: uuidv4(),
                name: args.name,
                studyAndDataManagers: [],
                applications: [],
                createdBy: requester.username,
                lastModified: new Date().valueOf(),
                deleted: false
            };
            let result: InsertOneWriteOpResult;

            result = await db.studies_collection!.insertOne(studyEntry);
            if (result.insertedCount !== 1) {
                throw new ApolloError('Error in creating study. InsertedCount is not 1 although mongo operation does not throw error.');
            }
            return makeGenericReponse(args.name);
        },
        createApplication: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { study: studyName, application: applicationName, approvedFields }: { study: string, application: string, approvedFields: string[] } = args;
            const studySearchResult: Models.Study.IStudy = await db.studies_collection!.findOne({ name: studyName, deleted: false })!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new ApolloError('Study does not exist.');
            }
            if (requester.type !== Models.UserModels.userTypes.ADMIN && !studySearchResult.studyAndDataManagers.includes(requester.username)) {
                throw new ForbiddenError('Unauthorised.');
            }
            const application: IApplication = {
                study: studyName,
                id: uuidv4(),
                name: applicationName,
                pendingUserApprovals: [],
                applicationAdmins: [],
                applicationUsers: [],
                approvedFields: approvedFields === undefined ? [] : approvedFields
            };
            let result: UpdateWriteOpResult;

            result = await db.studies_collection!.updateOne({ name: studyName, deleted: false }, { $push: { applications: application } });
            if (result.result.ok !== 1) {
                throw new ApolloError('Error in creating study. InsertedCount is not 1 although mongo operation does not throw error.');
            }
            return makeGenericReponse(applicationName);
        },
        addUserToApplication: async(parent: object, args: any, context: any, info: any): Promise<void> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { username: userToBeAdded, study, type, application: applicationName }: { application: string, username: string, study: string, type: string } =  args;
            const studyQueryObj: any = { name: study, applications: { $elemMatch: { name: applicationName }} };
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                studyQueryObj.applications = { $elemMatch: { name: applicationName, applicationAdmins: requester.username }};
            }
            const studySearchResult: IStudy = await db.studies_collection!.findOne(studyQueryObj, { projection: { applications: { $elemMatch: { name: applicationName }}}})!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new UserInputError('Study does not exist or you do not have authorisation.');
            }

            const userSearchResult: Models.UserModels.IUser = await db.users_collection!.findOne({ username: userToBeAdded, deleted: false })!;
            if (userSearchResult === null || userSearchResult === undefined) {
                throw new UserInputError('User does not exist.');
            }

            const userIsDataAdmin = studySearchResult.applications[0].applicationAdmins.includes(userToBeAdded);
            const userIsDataUser = studySearchResult.applications[0].applicationUsers.includes(userToBeAdded);
            const typeToBeAddedIsAdmin = type === Models.Study.APPLICATION_USER_TYPE.applicationAdmin;
            let updateObj: any;

            // doing these else-ifs to avoid having to do multiple updates
            if (userIsDataAdmin && userIsDataUser) {  // shouldn't be true at any time if data is integral. but just in case
                if (typeToBeAddedIsAdmin) {
                    updateObj = { $pull: { dataUsers: userToBeAdded } };
                } else {
                    updateObj = { $pull: { 'applications.$.applicationAdmins': userToBeAdded } };
                }
            } else if (userIsDataAdmin) {
                if (!typeToBeAddedIsAdmin) {
                    updateObj = { $pull: { 'applications.$.applicationAdmins': userToBeAdded }, $push: { 'applications.$.applicationUsers': userToBeAdded } };
                } else {
                    return makeGenericReponse(applicationName);
                }
            } else if (userIsDataUser) {
                if (typeToBeAddedIsAdmin) {
                    updateObj = { $push: { 'applications.$.applicationAdmins': userToBeAdded }, $pull: { 'applications.$.applicationUsers': userToBeAdded } };
                } else {
                    return makeGenericReponse(applicationName);
                }
            } else if (!userIsDataAdmin && !userIsDataAdmin) {
                if (typeToBeAddedIsAdmin) {
                    updateObj = { $push: { 'applications.$.applicationAdmins': userToBeAdded } };
                } else {
                    updateObj = { $push: { 'applications.$.applicationUsers': userToBeAdded } };
                }
            }

            const updateResult: UpdateWriteOpResult = await db.studies_collection!.updateOne(
                { name: study, applications: { $elemMatch: { name: applicationName } }},
                updateObj
            );
            return makeGenericReponse(applicationName);
        },
        deleteUserFromApplication: async(parent: object, args: any, context: any, info: any): Promise<void> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { study, username: userToBeDeleted, application: applicationName }: { application: string, study: string, username: string } = args;
            // check whether the user is in the study // if yes then delete

            const studySearchResult: IStudy = await db.studies_collection!.findOne({
                name: study,
                deleted: false,
                'applications.name': applicationName
            }, { projection: { applications: { $elemMatch: { name: applicationName } } }})!;

            if (studySearchResult === null || studySearchResult === undefined) {
                throw new UserInputError('Study or application does not exist.');
            }

            if (!studySearchResult.applications[0].applicationAdmins.includes(userToBeDeleted) && !studySearchResult.applications[0].applicationUsers.includes(userToBeDeleted)) {
                return makeGenericReponse(applicationName);
            }

            const updateResult: UpdateWriteOpResult = await db.studies_collection!.updateOne(
                {
                    name: study,
                    deleted: false,
                    applications: { $elemMatch: { name: applicationName } }
                },
                { $pull: { 'applications.$.applicationAdmins': userToBeDeleted, 'applications.$.applicationUsers': userToBeDeleted } }
            );
            if (updateResult.result.ok !== 1) {
                throw new ApolloError('Cannot update record.');
            }
            return makeGenericReponse(applicationName);
        },
        deleteStudy: async(parent: object, args: any, context: any, info: any): Promise<void> => {
            const db: Database = context.db;
            const user: Models.UserModels.IUser = context.req.user;
            // TO_DO: delete patients too?
        },
        applyToBeAddedToApplication: async(parent: object, args: any, context: any, info: any): Promise<void> => {
            const db: Database = context.db;
            const user: Models.UserModels.IUser = context.req.user;
            const { study, type, application }: { application: string, study: string, type: APPLICATION_USER_TYPE } = args;
            const notification = Models.Notifications.requestToBeAddedToApplication(user.username, study, application, type);
            const studySearchResult: Models.Study.IStudy = await db.studies_collection!.findOne({ name: study, 'applications.name': application, deleted: false }, { projection: { applications: { $elemMatch: { name: application }}}})!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new ApolloError('Cannot find study.');
            }
            const listOfApplicationAdmin: string[] = studySearchResult.applications[0].applicationAdmins;
            const updateResult: WriteOpResult = await db.users_collection!.update(
                { $or: [{ type: Models.UserModels.userTypes.ADMIN }, { username: { $in: listOfApplicationAdmin }}] },
                { $push: { notifications: {
                    $each: [notification],
                    $position: 0
                }}}
            );
            if (updateResult.result.ok !== 1) {
                throw new ApolloError('Internal error.');
            }
            // TO_DO: add applications pendingUserApprovals
            return makeGenericReponse(application);
        }
    }
};
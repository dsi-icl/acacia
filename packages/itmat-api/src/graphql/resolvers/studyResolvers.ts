import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter } from 'apollo-server-express';
import { InsertOneWriteOpResult, UpdateWriteOpResult, WriteOpResult, FindAndModifyWriteOpResultObject, FindOneAndUpdateOption } from 'mongodb';
import { IStudy, APPLICATION_USER_TYPE, IApplication } from 'itmat-utils/dist/models/study';
import { makeGenericReponse } from '../responses';
import uuidv4 from 'uuid/v4';
import config from '../../../config/config.json';
import { pubsub, subscriptionEvents } from '../pubsub';

export const studyResolvers = {
    Query: {
        getStudies: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy[]> => {
            const db: Database = context.db;
            const collection = db.studies_collection!;
            const requester: Models.UserModels.IUser = context.req.user;
            const requestedFields: string[] = info.fieldNodes[0].selectionSet.selections.map((el: any) => el.name.value);

            // standard users are not allowed to query jobs;
            if (requestedFields.includes('jobs') && args.name === undefined && requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Non-admins cannot query \'jobs\'.');
            }

            // standard users are not allowed to query pendingUserApprovals, applicationUsers, approvedFields of applications;
            if (requestedFields.includes('applications') && args.name === undefined && requester.type !== Models.UserModels.userTypes.ADMIN) {
                const forbiddenFields = ['pendingUserApprovals', 'applicationUsers', 'approvedFields'];
                const subApplicationRequestedFields = info.fieldNodes[0].selectionSet.selections.filter((el: any) => el.name.value === 'applications')[0].selectionSet.selections.map((el: any) => el.name.value);
                for (const each of subApplicationRequestedFields) {
                    if (forbiddenFields.includes(each)) {
                        throw new ForbiddenError(`Non-admins cannot query ${forbiddenFields.toString()} on 'applications'.`);
                    }
                }
            }

            const queryObj: any = { deleted: false };
            const projectionObj: any = { _id: 0, iHaveAcess: 1 };
            for (const each of requestedFields) {
                projectionObj[each] = 1;
            }

            // if the user is not admin and he is looking for a specific study. He can only see that if he's an admin or user of that study.
            // if (args.name !== undefined && requester.type !== Models.UserModels.userTypes.ADMIN) {
            //     queryObj.$or = [{ studyAndDataManagers: requester.username }, { 'applications.applicationAdmins': requester.username }, { 'applications.applicationUsers': requester.username }];
            // }

            if (args.name !== undefined) {
                queryObj.name = args.name;
            }

            const addFieldStage1 = {
                $addFields: {
                    allUsers: {
                        $reduce: {
                            input: '$applications',
                            initialValue: '$studyAndDataManagers',
                            in: { $concatArrays: ['$$value', '$$this.applicationAdmins', '$$this.applicationUsers'] }
                        }
                    }
                }
            };

            const addFieldStage2 = {
                $addFields: { iHaveAccess: requester.type !== Models.UserModels.userTypes.ADMIN ?
                    { $in: [requester.username, '$allUsers'] }
                    : true
                }
            };

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
                    addFieldStage1,
                    addFieldStage2,
                    { $project: projectionObj }
                ];
            } else {
                aggregatePipeline = [
                    { $match: queryObj },
                    addFieldStage1,
                    addFieldStage2,
                    { $project: projectionObj }
                ];
            }
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
                isUkbiobank: args.isUkbiobank,
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
            } else {
                delete studyEntry.deleted;
                return studyEntry;
            }
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

            const result = await db.studies_collection!.findOneAndUpdate({ name: studyName, deleted: false }, { $push: { applications: application }, $set: { lastModified: new Date().valueOf() } }, { returnOriginal: false, projection: { _id: 0, deleted: 0 } });
            if (result.ok !== 1) {
                throw new ApolloError('Error in creating study. InsertedCount is not 1 although mongo operation does not throw error.');
            }
            pubsub.publish(subscriptionEvents.study.NEW_APPLICATION_CREATED, { newApplicationCreated: application });
            return result.value;
        },
        deleteApplication: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { study: studyName, application: applicationName }: { study: string, application: string } = args;
            const studySearchResult: Models.Study.IStudy = await db.studies_collection!.findOne({ name: studyName, deleted: false })!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new ApolloError('Study does not exist.');
            }
            if (requester.type !== Models.UserModels.userTypes.ADMIN && !studySearchResult.studyAndDataManagers.includes(requester.username)) {
                throw new ForbiddenError('Unauthorised.');
            }

            const result = await db.studies_collection!.findOneAndUpdate({ name: studyName, deleted: false }, { $pull: { applications: { name: applicationName } }, $set: { lastModified: new Date().valueOf() } }, { returnOriginal: false, projection: { _id: 0, deleted: 0 } });
            if (result.ok !== 1) {
                throw new ApolloError('Error in creating study. InsertedCount is not 1 although mongo operation does not throw error.');
            }
            return result.value;
        },
        addUserToApplication: async(parent: object, args: any, context: any, info: any): Promise<IApplication> => {
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
                    return studySearchResult.applications[0];
                }
            } else if (userIsDataUser) {
                if (typeToBeAddedIsAdmin) {
                    updateObj = { $push: { 'applications.$.applicationAdmins': userToBeAdded }, $pull: { 'applications.$.applicationUsers': userToBeAdded } };
                } else {
                    return studySearchResult.applications[0];
                }
            } else if (!userIsDataAdmin && !userIsDataAdmin) {
                if (typeToBeAddedIsAdmin) {
                    updateObj = { $push: { 'applications.$.applicationAdmins': userToBeAdded } };
                } else {
                    updateObj = { $push: { 'applications.$.applicationUsers': userToBeAdded } };
                }
            }

            const updateResult: FindAndModifyWriteOpResultObject = await db.studies_collection!.findOneAndUpdate(
                { name: study, applications: { $elemMatch: { name: applicationName } }},
                updateObj,
                { projection: { applications: { $elemMatch: { name: applicationName } } }, returnOriginal: false }
            );
            if (updateResult.ok !== 1) {
                throw new ApolloError('Cannot update record.');
            }
            if (updateResult.value.applications && updateResult.value.applications[0]) {
                return updateResult.value.applications[0];
            } else {
                throw new ApolloError('Cannot update record.');
            }
        },
        deleteUserFromApplication: async(parent: object, args: any, context: any, info: any): Promise<IApplication> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { study, username: userToBeDeleted, application: applicationName }: { application: string, study: string, username: string } = args;
            // check whether the user is in the study // if yes then delete
            // check permission TO_DO
            const studySearchResult: IStudy = await db.studies_collection!.findOne({
                name: study,
                deleted: false,
                'applications.name': applicationName
            }, { projection: { applications: { $elemMatch: { name: applicationName } } }})!;

            if (studySearchResult === null || studySearchResult === undefined) {
                throw new UserInputError('Study or application does not exist.');
            }

            if (!studySearchResult.applications[0].applicationAdmins.includes(userToBeDeleted) && !studySearchResult.applications[0].applicationUsers.includes(userToBeDeleted)) {
                return studySearchResult.applications[0];
            }

            const updateResult: FindAndModifyWriteOpResultObject = await db.studies_collection!.findOneAndUpdate(
                {
                    name: study,
                    deleted: false,
                    applications: { $elemMatch: { name: applicationName } }
                },
                { $pull: { 'applications.$.applicationAdmins': userToBeDeleted, 'applications.$.applicationUsers': userToBeDeleted } },
                { projection: { applications: { $elemMatch: { name: applicationName } } }, returnOriginal: false }
            );
            if (updateResult.ok !== 1) {
                throw new ApolloError('Cannot update record.');
            }
            if (updateResult.value.applications && updateResult.value.applications[0]) {
                return updateResult.value.applications[0];
            } else {
                throw new ApolloError('Cannot update record.');
            }

        },
        deleteStudy: async(parent: object, args: any, context: any, info: any): Promise<void> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const study: string = args.name;
            // TO_DO: delete patients too?
            const queryObj = requester.type === Models.UserModels.userTypes.ADMIN ? { name: study, deleted: false } : { name: study, deleted: false, studyAndDataManagers: requester.username };
            const updateResult: UpdateWriteOpResult = await db.studies_collection!.updateOne(queryObj, { $set: { deleted: true } })!;
            if (updateResult.modifiedCount === 1) {
                return makeGenericReponse(study);
            } else if (updateResult.modifiedCount === 0) {
                if (requester.type === Models.UserModels.userTypes.ADMIN) {
                    return makeGenericReponse(study);
                } else {
                    throw new ForbiddenError('Study does not exist or you do not have permission to delete it.');
                }
            } else {
                throw new ApolloError('Server error.');
            }
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
        },
        addUserToStudyManagers: updateStudyManagers('$addToSet'),
        removeUserFromStudyManagers: updateStudyManagers('$pull')
    },
    Subscription: {
        newApplicationCreated: {
            subscribe: withFilter(
                () => pubsub.asyncIterator(subscriptionEvents.study.NEW_APPLICATION_CREATED),
                (payload, arg) => {
                    console.log(payload, arg, payload.newApplicationCreated.study === arg.studyName);
                    return payload.newApplicationCreated.study === arg.studyName;
                }
            )
        }
    }
};

function updateStudyManagers(operation: string) {
    return async(parent: object, args: any, context: any, info: any): Promise<void> => {
        const db: Database = context.db;
        const requester: Models.UserModels.IUser = context.req.user;
        const { username, study }: { study: string, username: string } = args;

        if (requester.type !== Models.UserModels.userTypes.ADMIN) {
            throw new ForbiddenError('Unauthorised.');
        }

        const studySearchResult: IStudy = await db.studies_collection!.findOne({ name: study, deleted: false })!;
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new UserInputError('Study does not exist or you do not have authorisation.');
        }

        const userSearchResult: Models.UserModels.IUser = await db.users_collection!.findOne({ username, deleted: false })!;
        if (userSearchResult === null || userSearchResult === undefined) {
            throw new UserInputError('User does not exist.');
        }

        const updateResult: FindAndModifyWriteOpResultObject = await db.studies_collection!.findOneAndUpdate({ name: study, deleted: false }, { [operation]: { studyAndDataManagers: username } }, { returnOriginal: false })!;
        if (updateResult.ok !== 1) {
            throw new ApolloError('Cannot update record.');
        }
        return updateResult.value;
    };
}
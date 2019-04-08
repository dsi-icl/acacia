import { Models, permissions } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter, defaultMergedResolver } from 'apollo-server-express';
import { InsertOneWriteOpResult, UpdateWriteOpResult, WriteOpResult, FindAndModifyWriteOpResultObject, FindOneAndUpdateOption } from 'mongodb';
import { IStudy, IProject, IRole } from 'itmat-utils/dist/models/study';
import { makeGenericReponse, IGenericResponse } from '../responses';
import uuidv4 from 'uuid/v4';
import config from '../../../config/config.json';
import { pubsub, subscriptionEvents } from '../pubsub';
import { permissionCore } from '../core/permissionCore';
import { Request, Response } from 'express';
import uuid = require('uuid');

export const studyResolvers = {
    Query: {
        getStudies: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IStudy[]> => {
            const db: Database = context.db;
            const collection = db.collections!.studies_collection;
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

            /* only admins are able to create study */
            if (requester.type !== Models.UserModels.userTypes.ADMIN) {
                throw new ForbiddenError('Unauthorised.');
            }

            const studyEntry: Models.Study.IStudy = {
                id: uuidv4(),
                name: args.name,
                isUkbiobank: args.isUkbiobank,
                roles: [],
                createdBy: requester.username,
                lastModified: new Date().valueOf(),
                deleted: false
            };

            const result: InsertOneWriteOpResult = await db.collections!.studies_collection.insertOne(studyEntry);
            if (result.insertedCount !== 1) {
                throw new ApolloError('Error in creating study. InsertedCount is not 1 although mongo operation does not throw error.');
            } else {
                delete studyEntry.deleted;
                return studyEntry;
            }
        },
        createProject: async(parent: object, args: any, context: any, info: any): Promise<Models.Study.IProject> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { study: studyName, application: applicationName, approvedFields }: { study: string, application: string, approvedFields: string[] } = args;

            await permissionCore.bounceUnauthorizedUsers(
                [
                    permissions.all_studies_manage_projects,
                    permissions.specific_study_projects_existence_management
                ],
                requester.username, studyName
            );
            
            /* making sure that the study exists first */
            const studySearchResult: Models.Study.IStudy = await db.collections!.studies_collection.findOne({ name: studyName, deleted: false })!;
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new ApolloError('Study does not exist.');
            }

            /* if the study exists then create the project */
            const project: IProject = {
                roles: [],
                patientMapping: {},  // mapping created lazily by query service (first time query from the application)
                lastModified: new Date().valueOf(),
                deleted: false,
                createdBy: requester.createdBy,
                study: studyName,
                id: uuidv4(),
                name: applicationName,
                approvedFields: approvedFields === undefined ? [] : approvedFields
            };

            const result = await db.collections!.projects_collection.insertOne(project);
            if (result.result.ok !== 1) {
                throw new ApolloError('Error in creating project. InsertedCount is not 1 although mongo operation does not throw error.');
            }
            return project;
        },
        deleteProject: async(parent: object, args: any, context: any, info: any): Promise<IGenericResponse> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const { study: studyName, project: projectName }: { study: string, project: string } = args;

            const projectUpdateResult = await db.collections!.projects_collection.updateOne({ name: projectName, study: studyName, deleted: false }, { $set: { deleted: true } });
            if (projectUpdateResult.result.ok === 1 && projectUpdateResult.result.nModified === 1) {
                return makeGenericReponse();
            } else {
                throw new ApolloError('Error in deleting project. It may not have existed or an internal error may have occured.');
            }
        },
        deleteStudy: async(parent: object, args: any, context: any, info: any): Promise<IGenericResponse> => {
            const db: Database = context.db;
            const requester: Models.UserModels.IUser = context.req.user;
            const study: string = args.name;
            // TO_DO: delete patients too?
            const queryObj = requester.type === Models.UserModels.userTypes.ADMIN ? { name: study, deleted: false } : { name: study, deleted: false, studyAndDataManagers: requester.username };
            const updateResult: UpdateWriteOpResult = await db.collections!.studies_collection.updateOne(queryObj, { $set: { deleted: true } })!;
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
        }
    },
    Subscription: {}
};
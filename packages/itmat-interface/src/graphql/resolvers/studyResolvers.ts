import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter, defaultMergedResolver } from 'apollo-server-express';
import { InsertOneWriteOpResult, UpdateWriteOpResult, WriteOpResult, FindAndModifyWriteOpResultObject, FindOneAndUpdateOption } from 'mongodb';
import { IStudy, IProject, IRole } from 'itmat-utils/dist/models/study';
import { makeGenericReponse, IGenericResponse } from '../responses';
import config from '../../../config/config.json';

import { studyCore } from '../core/studyCore';
import { IUser, userTypes } from 'itmat-utils/dist/models/user';
import { fieldCore } from '../core/fieldCore';
import { errorCodes } from '../errors';

export const studyResolvers = {
    Query: {
        getStudies: async(parent: object, args: any, context: any, info: any): Promise<IStudy[]> => {
            const requester: IUser = context.req.user;
            const requestedFields: string[] = info.fieldNodes[0].selectionSet.selections.map((el: any) => el.name.value);

            // standard users are not allowed to query jobs;
            if (requestedFields.includes('jobs') && args.name === undefined && requester.type !== userTypes.ADMIN) {
                throw new ForbiddenError('Non-admins cannot query \'jobs\'.');
            }

            // standard users are not allowed to query pendingUserApprovals, applicationUsers, approvedFields of applications;
            if (requestedFields.includes('applications') && args.name === undefined && requester.type !== userTypes.ADMIN) {
                const forbiddenFields = ['pendingUserApprovals', 'applicationUsers', 'approvedFields'];
                const subApplicationRequestedFields = info.fieldNodes[0].selectionSet.selections.filter((el: any) => el.name.value === 'applications')[0].selectionSet.selections.map((el: any) => el.name.value);
                for (const each of subApplicationRequestedFields) {
                    if (forbiddenFields.includes(each)) {
                        throw new ForbiddenError(`Non-admins cannot query ${forbiddenFields.toString()} on 'applications'.`);
                    }
                }
            }
            return [];
        }
    },
    Mutation: {
        createStudy: async(parent: object, args: { name: string, isUkbiobank: boolean}, context: any, info: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;

            /* check privileges */

            /* create study */
            const study = await studyCore.createNewStudy(args.name, requester.id, args.isUkbiobank);
            return study;
        },
        createProject: async(parent: object, { studyId, projectName, approvedFields }: { studyId: string, projectName: string, approvedFields?: string[] }, context: any, info: any): Promise<IProject> => {
            const requester: IUser = context.req.user;

            /* check privileges */

            /* making sure that the study exists first */
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            /* create project */
            const project = await studyCore.createProjectForStudy(studyId, projectName, requester.username, approvedFields);
            return project;
        },
        deleteProject: async(parent: object, { projectId }: { projectId: string }, context: any, info: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;

            /* check privileges */

            /* delete project */
            await studyCore.deleteProject(projectId);
            return makeGenericReponse(projectId);
        },
        deleteStudy: async(parent: object, { studyId }: { studyId: string }, context: any, info: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;

            /* check privileges */

            /* delete project */
            await studyCore.deleteStudy(studyId);
            return makeGenericReponse(studyId);
        },
        // editProjectApprovedFields: async(parent: object, { projectId, changes }: { projectId: string, changes: {add: number[], remove: number[]} }, context: any, info: any): Promise<IProject> => {
        //     const requester: IUser = context.req.user;

        //     /* check privileges */

        //     /* check study id for the project */
        //     const project = await studyCore.findOneProject_throwErrorIfNotExist(projectId);
        //     const studyId = project.studyId;

        //     /* check all the adds are valid */
        //     const resultFields: string[] = fieldCore.getFieldsOfStudy(studyId, false, changes.add);
        //     if (resultFields.length !== changes.add.length) {
        //         throw new ApolloError('Some of the fields provided in your changes are not valid.', errorCodes.CLIENT_MALFORMED_INPUT);
        //     }

        //     /* edit approved fields */
        //     const resultingProject = await studyCore.editProjectApprovedFields(projectId, changes);
        //     return resultingProject;
        // },
    },
    Subscription: {}
};
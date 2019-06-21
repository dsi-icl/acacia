import { Database, db } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter, defaultMergedResolver } from 'apollo-server-express';
import { InsertOneWriteOpResult, UpdateWriteOpResult, WriteOpResult, FindAndModifyWriteOpResultObject, FindOneAndUpdateOption } from 'mongodb';
import { IStudy, IProject, IRole } from 'itmat-utils/dist/models/study';
import { makeGenericReponse, IGenericResponse } from '../responses';
import config from '../../../config/config.json';

import { studyCore } from '../core/studyCore';
import { IUser, userTypes } from 'itmat-utils/dist/models/user';
import { fieldCore } from '../core/fieldCore';
import { errorCodes } from '../errors';
import { permissionCore } from '../core/permissionCore';
import { permissions } from 'itmat-utils';

export const studyResolvers = {
    Query: {
        getStudy: async(parent: object, args: any, context: any, info: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;
            const studyId: string = args.studyId;

            /* check if user has permission */

            /* get study */
            return await db.collections!.studies_collection.findOne({ id: studyId, deleted: false })!;
        },
        getProject: async(parent: object, args: any, context: any, info: any): Promise<IProject> => {
            const requester: IUser = context.req.user;
            const projectId: string = args.projectId;

            /* check if user has permission */

            /* get study */
            return await db.collections!.projects_collection.findOne({ id: projectId, deleted: false }, { projection: { patientMapping: 0 } })!;
        }
    },
    Study: {
        projects: async(study: IStudy) => {
            return await db.collections!.projects_collection.find({ studyId: study.id, deleted: false }).toArray();
        },
        jobs: async(study: IStudy) => {
            return await db.collections!.jobs_collection.find({ studyId: study.id, deleted: false }).toArray();
        },
        roles: async(study: IStudy) => {
            return await db.collections!.roles_collection.find({ studyId: study.id, deleted: false }).toArray();
        },
        fields: async(study: IStudy) => {
            return await db.collections!.field_dictionary_collection.find({ studyId: study.id, deleted: false }).toArray();
        }
    },
    Project: {
        fields: async(project: IProject) => {
            return await db.collections!.field_dictionary_collection.find({ studyId: project.studyId, id: { $in: project.approvedFields }, deleted: false }).toArray();
        },
        patientMapping: async(project: IProject) => {
            /* check permission */

            const result = await db.collections!.projects_collection.findOne({ id: project.id, deleted: false }, { projection: { patientMapping: 1 }});
            if (result && result.patientMapping) {
                return result.patientMapping;
            } else {
                return null;
            }
        },
        approvedFields: async(project: IProject) => {
            /* check permission */

            const result = await db.collections!.projects_collection.findOne({ id: project.id, deleted: false }, { projection: { approvedFields: 1 }});
            if (result && result.approvedFields) {
                return result.approvedFields;
            } else {
                return null;
            }
        },
        roles: async(project: IProject) => {
            return await db.collections!.roles_collection.find({ studyId: project.studyId, projectId: project.id, deleted: false }).toArray();
        },
        iCanEdit: async(project: IProject) => { // TO_DO
            const result = await db.collections!.roles_collection.findOne({
                studyId: project.studyId,
                projectId: project.id,
                // permissions: permissions.specific_project.specifi
            });
            return true;
        }
    },
    Mutation: {
        createStudy: async(parent: object, args: { name: string }, context: any, info: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;

            /* check privileges */

            /* create study */
            const study = await studyCore.createNewStudy(args.name, requester.id);
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
        editProjectApprovedFields: async(parent: object, { projectId, approvedFields }: { projectId: string, approvedFields: string[] }, context: any, info: any): Promise<IProject> => {
            const requester: IUser = context.req.user;

            /* check privileges */

            /* check study id for the project */
            const project = await studyCore.findOneProject_throwErrorIfNotExist(projectId);
            const studyId = project.studyId;

            /* check all the adds are valid */
            // const resultFields: string[] = fieldCore.getFieldsOfStudy(studyId, false, changes.add);
            // if (resultFields.length !== changes.add.length) {
            //     throw new ApolloError('Some of the fields provided in your changes are not valid.', errorCodes.CLIENT_MALFORMED_INPUT);
            // }

            /* edit approved fields */
            const resultingProject = await studyCore.editProjectApprovedFields(projectId, approvedFields);
            return resultingProject;
        },
    },
    Subscription: {}
};
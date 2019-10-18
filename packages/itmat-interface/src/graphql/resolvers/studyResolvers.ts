import { ApolloError } from 'apollo-server-express';
import { permissions } from 'itmat-commons';
import { IFieldEntry } from 'itmat-commons/dist/models/field';
import { IProject, IStudy, IStudyDataVersion } from 'itmat-commons/dist/models/study';
import { IUser } from 'itmat-commons/dist/models/user';
import uuid from 'uuid/v4';
import { db } from '../../database/database';
import { permissionCore } from '../core/permissionCore';
import { studyCore } from '../core/studyCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';

export const studyResolvers = {
    Query: {
        getStudy: async (parent: object, args: any, context: any, info: any): Promise<IStudy | null> => {
            const requester: IUser = context.req.user;
            const studyId: string = args.studyId;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            return await db.collections!.studies_collection.findOne({ id: studyId, deleted: false })!;
        },
        getProject: async (parent: object, args: any, context: any, info: any): Promise<IProject | null> => {
            const requester: IUser = context.req.user;
            const projectId: string = args.projectId;

            /* get project */
            const project: IProject | null = await db.collections!.projects_collection.findOne({ id: projectId, deleted: false }, { projection: { patientMapping: 0 } })!;

            if (project === null) {
                return null;
            }

            /* check if user has permission */
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_project.specific_project_readonly_access],
                requester,
                project.studyId,
                projectId
            );

            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                project.studyId
            );

            if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            return project;
        },
        getStudyFields: async (parent: object, { fieldTreeId, studyId }: { fieldTreeId: string, studyId: string }, context: any): Promise<IFieldEntry[]> => {
            const requester: IUser = context.req.user;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const result = await db.collections!.field_dictionary_collection.find({ studyId, fieldTreeId }).toArray();

            return result;
        }
    },
    Study: {
        projects: async (study: IStudy) => {
            return await db.collections!.projects_collection.find({ studyId: study.id, deleted: false }).toArray();
        },
        jobs: async (study: IStudy) => {
            return await db.collections!.jobs_collection.find({ studyId: study.id }).toArray();
        },
        roles: async (study: IStudy) => {
            return await db.collections!.roles_collection.find({ studyId: study.id, deleted: false }).toArray();
        },
        files: async (study: IStudy) => {
            return await db.collections!.files_collection.find({ studyId: study.id, deleted: false }).toArray();
        },
        numOfSubjects: async (study: IStudy) => {
            return await db.collections!.data_collection.countDocuments({ m_study: study.id });
        },
        currentDataVersion: async (study: IStudy) => {
            return study.currentDataVersion === -1 ? null : study.currentDataVersion;
        }
    },
    Project: {
        fields: async (project: IProject) => {
            return await db.collections!.field_dictionary_collection.find({ studyId: project.studyId, id: { $in: project.approvedFields }, deleted: false }).toArray();
        },
        jobs: async (project: IProject) => {
            return await db.collections!.jobs_collection.find({ studyId: project.studyId, projectId: project.id }).toArray();
        },
        files: async (project: IProject) => {
            return await db.collections!.files_collection.find({ studyId: project.studyId, id: { $in: project.approvedFiles }, deleted: false }).toArray();
        },
        patientMapping: async (project: IProject) => {
            /* check permission */

            const result = await db.collections!.projects_collection.findOne({ id: project.id, deleted: false }, { projection: { patientMapping: 1 } });
            if (result && result.patientMapping) {
                return result.patientMapping;
            } else {
                return null;
            }
        },
        approvedFields: async (project: IProject) => {
            /* check permission */

            const result = await db.collections!.projects_collection.findOne({ id: project.id, deleted: false }, { projection: { approvedFields: 1 } });
            if (result && result.approvedFields) {
                return result.approvedFields;
            } else {
                return null;
            }
        },
        approvedFiles: async (project: IProject) => {
            /* check permission */

            return project.approvedFiles;
        },
        roles: async (project: IProject) => {
            return await db.collections!.roles_collection.find({ studyId: project.studyId, projectId: project.id, deleted: false }).toArray();
        },
        iCanEdit: async (project: IProject) => { // TO_DO
            const result = await db.collections!.roles_collection.findOne({
                studyId: project.studyId,
                projectId: project.id
                // permissions: permissions.specific_project.specifi
            });
            return true;
        }
    },
    Mutation: {
        createStudy: async (parent: object, { name }: { name: string }, context: any, info: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;

            /* reject undefined project name */
            if (!name) {
                throw new ApolloError('Study name is not given or undefined.');
            }

            /* check privileges */

            /* create study */
            const study = await studyCore.createNewStudy(name, requester.id);
            return study;
        },
        createProject: async (parent: object, { studyId, projectName, approvedFields }: { studyId: string, projectName: string, approvedFields?: string[] }, context: any, info: any): Promise<IProject> => {
            const requester: IUser = context.req.user;

            /* reject undefined project name */
            if (!projectName) {
                throw new ApolloError('Project name is not given or undefined.');
            }

            /* check privileges */

            /* making sure that the study exists first */
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            /* create project */
            const project = await studyCore.createProjectForStudy(studyId, projectName, requester.username, approvedFields);
            return project;
        },
        deleteProject: async (parent: object, { projectId }: { projectId: string }, context: any, info: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;

            /* check privileges */

            /* delete project */
            await studyCore.deleteProject(projectId);
            return makeGenericReponse(projectId);
        },
        deleteStudy: async (parent: object, { studyId }: { studyId: string }, context: any, info: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;

            /* check privileges */

            /* delete project */
            await studyCore.deleteStudy(studyId);
            return makeGenericReponse(studyId);
        },
        editProjectApprovedFields: async (parent: object, { projectId, approvedFields }: { projectId: string, approvedFields: string[] }, context: any, info: any): Promise<IProject> => {
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
        editProjectApprovedFiles: async (parent: object, { projectId, approvedFiles }: { projectId: string, approvedFiles: string[] }, context: any, info: any): Promise<IProject> => {
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
            const resultingProject = await studyCore.editProjectApprovedFiles(projectId, approvedFiles);
            return resultingProject;
        },
        setDataversionAsCurrent: async (parent: object, { studyId, dataVersionId }: { studyId: string, dataVersionId: string }, context: any, info: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;

            /* check privileges */

            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);


            /* check whether the dataversion exists */
            const selectedataVersionFiltered = study.dataVersions.filter((el) => el.id === dataVersionId);
            if (selectedataVersionFiltered.length !== 1) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }

            /* create a new dataversion with the same contentId */
            const newDataVersion: IStudyDataVersion = {
                ...selectedataVersionFiltered[0],
                id: uuid()
            };
            console.log(newDataVersion);

            /* add this to the database */
            const result = await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: false }, {
                $push: { dataVersions: newDataVersion }, $inc: { currentDataVersion: 1 }
            }, { returnOriginal: false });

            if (result.ok === 1) {
                return result.value;
            } else {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }
        }
    },
    Subscription: {}
};

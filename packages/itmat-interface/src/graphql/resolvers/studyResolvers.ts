import {
    IProject,
    IStudy,
    studyType,
    IDataClip,
    IOntologyTree
} from '@itmat-broker/itmat-types';
import { CreateFieldInput, EditFieldInput, StudyCore } from '@itmat-broker/itmat-cores';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';

const studyCore = Object.freeze(new StudyCore(db, objStore));

export const studyResolvers: DMPResolversMap = {
    Query: {
        getStudy: async (_parent, args: { studyId: string }, context) => {
            return studyCore.getStudy(context.req.user, args.studyId);
        },
        getProject: async (_parent, args: { projectId: string }, context) => {
            return await studyCore.getProject(context.req.user, args.projectId);
        },
        getStudyFields: async (_parent, { studyId, projectId, versionId }: { studyId: string, projectId?: string, versionId?: string | null }, context) => {
            return await studyCore.getStudyFields(context.req.user, studyId, projectId, versionId);
        },
        getOntologyTree: async (_parent, { studyId, projectId, treeName, versionId }: { studyId: string, projectId?: string, treeName?: string, versionId?: string }, context) => {
            return await studyCore.getOntologyTree(context.req.user, studyId, projectId, treeName, versionId);
        },
        checkDataComplete: async (_parent, { studyId }: { studyId: string }, context) => {
            return await studyCore.checkDataComplete(context.req.user, studyId);
        },
        getDataRecords: async (_parent, { studyId, queryString, versionId, projectId }: { queryString, studyId: string, versionId: string | null | undefined, projectId?: string }, context) => {
            return await studyCore.getDataRecords(context.req.user, queryString, studyId, versionId, projectId);
        }
    },
    Study: {
        projects: async (study: IStudy) => {
            return await studyCore.getStudyProjects(study);
        },
        jobs: async (study: IStudy) => {
            return await studyCore.getStudyJobs(study);
        },
        roles: async (study: IStudy) => {
            return await studyCore.getStudyRoles(study);
        },
        files: async (study: IStudy, _args: never, context) => {
            return await studyCore.getStudyFiles(context.req.user, study);
        },
        subjects: async (study: IStudy, _args: never, context) => {
            return await studyCore.getStudySubjects(context.req.user, study);
        },
        visits: async (study: IStudy, _args: never, context) => {
            return await studyCore.getStudyVisits(context.req.user, study);
        },
        numOfRecords: async (study: IStudy, _args: never, context) => {
            return await studyCore.getStudyNumOfRecords(context.req.user, study);
        },
        currentDataVersion: async (study: IStudy) => {
            return studyCore.getStudyCurrentDataVersion(study);
        }
    },
    Project: {
        fields: async (project: Omit<IProject, 'patientMapping'>, _args: never, context) => {
            return await studyCore.getProjectFields(context.req.user, project);
        },
        jobs: async (project: Omit<IProject, 'patientMapping'>) => {
            return await studyCore.getProjectJobs(project);
        },
        files: async (project: Omit<IProject, 'patientMapping'>, _args: never, context) => {
            return await studyCore.getProjectFiles(context.req.user, project);
        },
        dataVersion: async (project: IProject) => {
            return await studyCore.getProjectDataVersion(project);
        },
        summary: async (project: IProject, _args: never, context) => {
            return await studyCore.getProjectSummary(context.req.user, project);
        },
        patientMapping: async (project: IProject, _args: never, context) => {
            return await studyCore.getProjectPatientMapping(context.req.user, project);
        },
        roles: async (project: IProject) => {
            return await studyCore.getProjectRoles(project);
        },
        iCanEdit: async () => { // TO_DO
            return true;
        }
    },
    Mutation: {
        createStudy: async (_parent, { name, description, type }: { name: string, description: string, type: studyType }, context) => {
            return await studyCore.createNewStudy(context.req.user, name, description, type);
        },
        editStudy: async (_parent, { studyId, description }: { studyId: string, description: string }, context) => {
            return await studyCore.editStudy(context.req.user, studyId, description);
        },
        createNewField: async (_parent, { studyId, fieldInput }: { studyId: string, fieldInput: CreateFieldInput[] }, context) => {
            return await studyCore.createNewField(context.req.user, studyId, fieldInput);
        },
        editField: async (_parent, { studyId, fieldInput }: { studyId: string, fieldInput: EditFieldInput }, context) => {
            return await studyCore.editField(context.req.user, studyId, fieldInput);
        },
        deleteField: async (_parent, { studyId, fieldId }: { studyId: string, fieldId: string }, context) => {
            return await studyCore.deleteField(context.req.user, studyId, fieldId);
        },
        uploadDataInArray: async (_parent, { studyId, data }: { studyId: string, data: IDataClip[] }, context) => {
            return await studyCore.uploadDataInArray(context.req.user, studyId, data);
        },
        deleteDataRecords: async (_parent, { studyId, subjectIds, visitIds, fieldIds }: { studyId: string, subjectIds: string[], visitIds: string[], fieldIds: string[] }, context) => {
            return await studyCore.deleteDataRecords(context.req.user, studyId, subjectIds, visitIds, fieldIds);
        },
        createNewDataVersion: async (_parent, { studyId, dataVersion, tag }: { studyId: string, dataVersion: string, tag: string }, context) => {
            return await studyCore.createNewDataVersion(context.req.user, studyId, dataVersion, tag);
        },
        createOntologyTree: async (_parent, { studyId, ontologyTree }: { studyId: string, ontologyTree: Pick<IOntologyTree, 'name' | 'routes'> }, context) => {
            return await studyCore.createOntologyTree(context.req.user, studyId, ontologyTree);
        },
        deleteOntologyTree: async (_parent, { studyId, treeName }: { studyId: string, treeName: string }, context) => {
            return await studyCore.deleteOntologyTree(context.req.user, studyId, treeName);
        },
        createProject: async (_parent, { studyId, projectName }: { studyId: string, projectName: string }, context) => {
            return await studyCore.createProjectForStudy(context.req.user, studyId, projectName);
        },
        deleteProject: async (_parent, { projectId }: { projectId: string }, context) => {
            return await studyCore.deleteProject(context.req.user, projectId);
        },
        deleteStudy: async (_parent, { studyId }: { studyId: string }, context) => {
            return await studyCore.deleteStudy(context.req.user, studyId);
        },
        setDataversionAsCurrent: async (_parent, { studyId, dataVersionId }: { studyId: string, dataVersionId: string }, context) => {
            return await studyCore.setDataversionAsCurrent(context.req.user, studyId, dataVersionId);
        }
    },
    Subscription: {}
};

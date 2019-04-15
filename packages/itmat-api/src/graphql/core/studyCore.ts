import mongodb from 'mongodb';
import { db } from '../../database/database';
import { permissions } from 'itmat-utils';
import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy, IRole } from 'itmat-utils/dist/models/study';
import { errorCodes } from '../errors';
import uuidv4 from 'uuid/v4';
import { IUser, userTypes } from 'itmat-utils/dist/models/user';
import { PermissionCore, permissionCore } from './permissionCore';

export class StudyCore {
    constructor(private readonly permissionCore: PermissionCore){}

    async findOneStudy_throwErrorIfNotExist(studyId: string): Promise<IStudy> {
        const studySearchResult: IStudy = await db.collections!.studies_collection.findOne({ id: studyId, deleted: false })!;
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new ApolloError('Study does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return studySearchResult;
    }

    async findOneProject_throwErrorIfNotExist(projectId: string): Promise<IProject> {
        const projectSearchResult: IProject = await db.collections!.projects_collection.findOne({ id: projectId, deleted: false })!;
        if (projectSearchResult === null || projectSearchResult === undefined) {
            throw new ApolloError('Project does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return projectSearchResult;
    }

    async createNewStudy(studyName: string, requestedBy: string, isUkbiobank: boolean): Promise<IStudy> {
        const study: IStudy = {
            id: uuidv4(),
            name: studyName,
            isUkbiobank,
            createdBy: requestedBy,
            lastModified: new Date().valueOf(),
            deleted: false
        };
        await db.collections!.studies_collection.insertOne(study);
        return study;
    }

    async createProjectForStudy(studyId: string, projectName: string, requestedBy: string, approvedFields?: string[]): Promise<IProject> {
        const project: IProject = {
            id: uuidv4(),
            studyId,
            createdBy: requestedBy,
            name: projectName,
            patientMapping: {},
            approvedFields: approvedFields ? approvedFields : [],
            lastModified: new Date().valueOf(),
            deleted: false
        };
        await db.collections!.projects_collection.insertOne(project);
        return project;
    }

    async deleteStudy(studyId: string): Promise<void> {
        const session = db.client.startSession();
        session.startTransaction();

        try {
            const opts = { session, returnOriginal: false };
            /* delete the study */
            await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: false }, { $set: { lastModified: new Date().valueOf(), deleted: true   }});

            /* delete all projects related to the study */
            await db.collections!.projects_collection.updateMany({ studyId, deleted: false }, { $set: { lastModified: new Date().valueOf(), deleted: true } });

            /* delete all roles related to the study */
            await this.permissionCore.removeRoleFromStudyOrProject({ studyId });

            /* delete all data */
            // TO_DO

            await session.commitTransaction();
            session.endSession();

        } catch (error) {
            // If an error occurred, abort the whole transaction and
            // undo any changes that might have happened
            await session.abortTransaction();
            session.endSession();
            throw error; // Rethrow so calling function sees error
        }
    }

    async deleteProject(projectId: string): Promise<void> {
        const session = db.client.startSession();
        session.startTransaction();

        try {
            const opts = { session, returnOriginal: false };

            /* delete all projects related to the study */
            await db.collections!.projects_collection.updateMany({ id: projectId, deleted: false }, { $set: { lastModified: new Date().valueOf(), deleted: true } }, opts);

            /* delete all roles related to the study */
            await this.permissionCore.removeRoleFromStudyOrProject({ projectId });

            await session.commitTransaction();
            session.endSession();

        } catch (error) {
            // If an error occurred, abort the whole transaction and
            // undo any changes that might have happened
            await session.abortTransaction();
            session.endSession();
            throw error; // Rethrow so calling function sees error
        }
    }

    async editProjectApprovedFields(projectId: string, changes: { add: number[], remove: number[] } ) {
        /* PRECONDITION: assuming all the fields to add exist (no need for the same for remove because it just pulls whatever)*/
        const result = await db.collections!.projects_collection.findOneAndUpdate({ id: projectId }, { $push: { approvedFields: { $each: changes.add } }, $pull: { approvedFields: { $each: changes.remove }} });
        if (result.ok === 1) {
            return result.value;
        } else {
            throw new ApolloError(`Cannot update project "${projectId}"`, errorCodes.DATABASE_ERROR);
        }
    }
}

export const studyCore = Object.freeze(new StudyCore(permissionCore));
import mongodb from 'mongodb';
import { db } from '../../database/database';
import { permissions } from 'itmat-utils';
import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy, IRole } from 'itmat-utils/dist/models/study';
import { errorCodes } from '../errors';
import uuidv4 from 'uuid/v4';
import { IUser, userTypes } from 'itmat-utils/dist/models/user';

export class StudyCore {
    constructor(private readonly studyCollection: mongodb.Collection, private readonly projectCollection: mongodb.Collection){}

    async findOneStudy_throwErrorIfNotExist(studyId: string): Promise<IStudy> {
        const studySearchResult: IStudy = await this.studyCollection.findOne({ id: studyId, deleted: false })!;
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new ApolloError('Study does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return studySearchResult;
    }

    async findOneProject_throwErrorIfNotExist(projectId: string): Promise<IProject> {
        const projectSearchResult: IProject = await this.projectCollection.findOne({ id: projectId, deleted: false })!;
        if (projectSearchResult === null || projectSearchResult === undefined) {
            throw new ApolloError('Project does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return projectSearchResult;
    }

}

export const studyCore = Object.freeze(new StudyCore(db.collections!.studies_collection, db.collections!.projects_collection));
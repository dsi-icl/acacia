import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';
import { PermissionCore, permissionCore } from './permissionCore';

export class StudyCore {
    constructor(private readonly localPermissionCore: PermissionCore) { }

    public async findOneStudy_throwErrorIfNotExist(studyId: string): Promise<IStudy> {
        const studySearchResult: IStudy = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null })!;
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new ApolloError('Study does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return studySearchResult;
    }

    public async findOneProject_throwErrorIfNotExist(projectId: string): Promise<IProject> {
        const projectSearchResult: IProject = await db.collections!.projects_collection.findOne({ id: projectId, deleted: null })!;
        if (projectSearchResult === null || projectSearchResult === undefined) {
            throw new ApolloError('Project does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return projectSearchResult;
    }

    public async createNewStudy(studyName: string, requestedBy: string): Promise<IStudy> {
        /* check if study already  exist (lowercase because S3 minio buckets cant be mixed case) */
        const existingStudies = await db.collections!.studies_collection.aggregate(
            [
                { $match: { deleted: null } },
                {
                    $group: {
                        _id: '',
                        name: {
                            $push: { $toLower: '$name' }
                        }
                    }
                },
                { $project: { name: 1 } }
            ]
        ).toArray();

        if (existingStudies[0] && existingStudies[0].name.includes(studyName.toLowerCase())) {
            throw new ApolloError(`Study "${studyName}" already exists (duplicates are case-insensitive).`);
        }

        const study: IStudy = {
            id: uuid(),
            name: studyName,
            createdBy: requestedBy,
            currentDataVersion: -1,
            lastModified: new Date().valueOf(),
            dataVersions: [],
            deleted: null
        };
        await db.collections!.studies_collection.insertOne(study);
        return study;
    }

    public async createProjectForStudy(studyId: string, projectName: string, requestedBy: string, approvedFields?: { [fieldTreeId: string]: string[] }, approvedFiles?: string[]): Promise<IProject> {
        const project: IProject = {
            id: uuid(),
            studyId,
            createdBy: requestedBy,
            name: projectName,
            patientMapping: {},
            approvedFields: approvedFields ? approvedFields : {},
            approvedFiles: approvedFiles ? approvedFiles : [],
            lastModified: new Date().valueOf(),
            deleted: null
        };

        const getListOfPatientsResult = await db.collections!.data_collection.aggregate([
            { $match: { m_study: studyId } },
            { $group: { _id: null, array: { $addToSet: '$m_eid' } } },
            { $project: { array: 1 } }
        ]).toArray();

        if (getListOfPatientsResult === null || getListOfPatientsResult === undefined) {
            throw new ApolloError('Cannot get list of patients', errorCodes.DATABASE_ERROR);
        }

        if (getListOfPatientsResult[0] !== undefined) {
            project.patientMapping = this.createPatientIdMapping(getListOfPatientsResult[0].array);
        }

        await db.collections!.projects_collection.insertOne(project);
        return project;
    }

    public async deleteStudy(studyId: string): Promise<void> {
        /* PRECONDITION: CHECKED THAT STUDY INDEED EXISTS */
        const session = db.client.startSession();
        session.startTransaction();

        const timestamp = new Date().valueOf();

        try {
            /* delete the study */
            await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } });

            /* delete all projects related to the study */
            await db.collections!.projects_collection.updateMany({ studyId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } });

            /* delete all roles related to the study */
            await this.localPermissionCore.removeRoleFromStudyOrProject({ studyId });

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

    public async deleteProject(projectId: string): Promise<void> {
        const opts = { returnOriginal: false };
        const timestamp = new Date().valueOf();

        /* delete all projects related to the study */
        await db.collections!.projects_collection.findOneAndUpdate({ id: projectId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } }, opts);

        /* delete all roles related to the study */
        await this.localPermissionCore.removeRoleFromStudyOrProject({ projectId });
    }

    public async editProjectApprovedFields(projectId: string, fieldTreeId: string, approvedFields: string[]): Promise<IProject> {
        /* PRECONDITION: assuming all the fields to add exist (no need for the same for remove because it just pulls whatever)*/
        const result = await db.collections!.projects_collection.findOneAndUpdate({ id: projectId }, { $set: { [`approvedFields.${fieldTreeId}`]: approvedFields } }, { returnOriginal: false });
        if (result.ok === 1) {
            return result.value;
        } else {
            throw new ApolloError(`Cannot update project "${projectId}"`, errorCodes.DATABASE_ERROR);
        }
    }

    public async editProjectApprovedFiles(projectId: string, approvedFiles: string[]): Promise<IProject> {
        /* PRECONDITION: assuming all the fields to add exist (no need for the same for remove because it just pulls whatever)*/
        const result = await db.collections!.projects_collection.findOneAndUpdate({ id: projectId }, { $set: { approvedFiles } }, { returnOriginal: false });
        if (result.ok === 1) {
            return result.value;
        } else {
            throw new ApolloError(`Cannot update project "${projectId}"`, errorCodes.DATABASE_ERROR);
        }
    }

    private createPatientIdMapping(listOfPatientId: string[], prefix?: string): { [originalPatientId: string]: string } {
        let rangeArray: Array<string | number> = [...Array.from(listOfPatientId.keys())];
        if (prefix === undefined) {
            prefix = uuid().substring(0, 10);
        }
        rangeArray = rangeArray.map((e) => `${prefix}${e}`);
        rangeArray = this.shuffle(rangeArray);
        const mapping: { [originalPatientId: string]: string } = {};
        for (let i = 0, length = listOfPatientId.length; i < length; i++) {
            mapping[listOfPatientId[i]] = (rangeArray as string[])[i];
        }
        return mapping;

    }

    private shuffle(array: Array<number | string>) {  // source: Fisher–Yates Shuffle; https://bost.ocks.org/mike/shuffle/
        let currentIndex = array.length;
        let temporaryValue: string | number;
        let randomIndex: number;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        return array;
    }
}

export const studyCore = Object.freeze(new StudyCore(permissionCore));

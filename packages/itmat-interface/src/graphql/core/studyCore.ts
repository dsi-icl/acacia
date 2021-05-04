import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy, studyType, IStudyDataVersion } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';
import { PermissionCore, permissionCore } from './permissionCore';
import { validate } from '@ideafast/idgen';
import { parseValue } from 'graphql';

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

    public async createNewStudy(studyName: string, description: string, type: studyType, requestedBy: string): Promise<IStudy> {
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
            deleted: null,
            description: description,
            type: type
        };
        await db.collections!.studies_collection.insertOne(study);
        return study;
    }

    public async editStudy(studyId: string, description: string): Promise<IStudy> {
        const res = await db.collections!.studies_collection.findOneAndUpdate({ id: studyId }, { $set: { description: description } }, { returnOriginal: false });
        if (res.ok === 1) {
            return res.value;
        } else {
            throw new ApolloError('Edit study failed');
        }
    }

    public async createNewDataVersion(fieldTreeId: string, studyId: string, tag: string, dataVersion: string): Promise<IStudyDataVersion> {
        const res = (await db.collections!.data_collection.find({ m_versionId: null })).toArray();
        if ((res as any).length <= 0) {
            throw new ApolloError('No records uploaded since last operation.');
        }
        const newDataVersionId = uuid();
        const contentId = uuid();
        // update record version
        const updateVersion = await db.collections!.data_collection.updateMany({ m_versionId: null }, { $set: { m_versionId: contentId } });
        if (updateVersion.result.ok !== 1) {
            throw new ApolloError('Create new adta version failed: cannot add data version to new records.');
        }
        // insert a new version into study
        const newDataVersion: IStudyDataVersion = {
            id: newDataVersionId,
            contentId: contentId, // same content = same id - used in reverting data, version control
            jobId: [],
            version: dataVersion,
            tag: tag,
            updateDate: (new Date().valueOf()).toString(),
            extractedFrom: [],
            fieldTrees: [fieldTreeId]
        };
        await db.collections!.studies_collection.updateOne({ id: studyId }, {
            $push: { dataVersions: newDataVersion },
            $inc: {
                currentDataVersion: 1
            }
        });
        return newDataVersion;
    }

    public async uploadOneDataClip(studyId: string, fieldList: any[], dataClip: any): Promise<any> {
        let fieldInDb;
        if (dataClip.fieldId) {
            fieldInDb = fieldList.filter(el => el.fieldId === dataClip.fieldId);
        } else {
            fieldInDb = fieldList.filter(el => (el.fieldName === dataClip.fieldName && el.tableName === dataClip.tableName));
        }
        if (!fieldInDb) {
            return { error: `Field ${dataClip.fieldId}-${dataClip.fieldName}-${dataClip.tableName} is not registered. Please update the annotations first.` };
        }
        // check subjectId
        if(!validate(dataClip.subjectId?.replace('-', '').substr(1) ?? '')) {
            throw new ApolloError('Subject ID is illegal.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        // check visitId is number
        if (!/^\d+$/.test(dataClip.visitId)) {
            throw new ApolloError('Visit ID is illegal.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        // check if field fOUND
        let error;


        // check value is valid
        let parsedValue;
        if (fieldInDb.length === 0) {
            error = `Field ${dataClip.fieldId}-${dataClip.fieldName}-${dataClip.tableName} : Field Not found`;
        } else {
            switch (fieldInDb[0].dataType) {
                case 'dec': // decimal
                    if (!/^\d+(.\d+)?$/.test(dataClip.value)) {
                        error = `Field ${dataClip.fieldId}-${dataClip.fieldName}-${dataClip.tableName} : Cannot parse as decimal.`;
                        break;
                    }
                    parsedValue = parseFloat(dataClip.value);
                    break;
                case 'int': // integer
                    if (!/^\d+$/.test(dataClip.value)) {
                        error = `Field ${dataClip.fieldId}-${dataClip.fieldName}-${dataClip.tableName} : Cannot parse as integer.`;
                        break;
                    }
                    parsedValue = parseInt(dataClip.value, 10);
                    break;
                case 'boo': // boolean
                    if (dataClip.value.toLowerCase() === 'true' || dataClip.value.toLowerCase() === 'false') {
                        parsedValue = dataClip.value.toLowerCase() === 'true';
                    } else {
                        error = `Field ${dataClip.fieldId}-${dataClip.fieldName}-${dataClip.tableName} : Cannot parse as boolean.`;
                        break;
                    }
                    break;
                case 'str':
                    parsedValue = dataClip.value.toString();
                    break;
                case 'dat':
                    parsedValue = dataClip.value.toString();
                    break;
                case 'jso': // save as string
                    parsedValue = JSON.stringify(dataClip.value);
                    break;
                case 'fil': {
                    const file = await db.collections!.files_collection.findOne({ id: parseValue });
                    if (!file) {
                        error = `Field ${dataClip.fieldId}-${dataClip.fieldName}-${dataClip.tableName} : Cannot parse as file or file does not exist.`;
                        break;
                    } else {
                        parsedValue = dataClip.value.toString();
                    }
                    break;
                }
                case 'unk':
                    parsedValue = dataClip.value.toString();
                    break;
                default:
                    error = (`Field ${dataClip.fieldId}-${dataClip.fieldName}-${dataClip.tableName} : Invalid data Type.`);
                    break;
            }
        }
        if (error !== undefined) {
            return { error: error };
        }
        const obj = {
            m_studyId: studyId,
            m_subjectId: dataClip.subjectId,
            m_versionId: null,
            m_visitId: dataClip.visitId
        };
        const objWithData = {
            ...obj,
        };
        objWithData[dataClip.fieldId] = parsedValue;
        await db.collections!.data_collection.findOneAndUpdate(obj, { $set: objWithData }, {
            upsert: true
        });
        return { error: null };

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
            { $match: { m_studyId: studyId } },
            { $group: { _id: null, array: { $addToSet: '$m_subjectId' } } },
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

            /* delete all files belong to the study*/
            await db.collections!.files_collection.updateMany({ studyId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } });

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

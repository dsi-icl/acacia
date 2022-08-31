import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy, studyType, IStudyDataVersion, DATA_CLIP_ERROR_TYPE } from 'itmat-commons';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';
import { PermissionCore, permissionCore } from './permissionCore';
import { validate } from '@ideafast/idgen';
import { parseValue } from 'graphql';
import type { MatchKeysAndValues } from 'mongodb';
import { IDataEntry } from '../../../../itmat-commons/dist/models/data';

export class StudyCore {
    constructor(private readonly localPermissionCore: PermissionCore) { }

    public async findOneStudy_throwErrorIfNotExist(studyId: string): Promise<IStudy> {
        const studySearchResult = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null })!;
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new ApolloError('Study does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return studySearchResult;
    }

    public async findOneProject_throwErrorIfNotExist(projectId: string): Promise<IProject> {
        const projectSearchResult = await db.collections!.projects_collection.findOne({ id: projectId, deleted: null })!;
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
        const res = await db.collections!.studies_collection.findOneAndUpdate({ id: studyId }, { $set: { description: description } }, { returnDocument: 'after' });
        if (res.ok === 1 && res.value) {
            return res.value;
        } else {
            throw new ApolloError('Edit study failed');
        }
    }

    public async createNewDataVersion(studyId: string, tag: string, dataVersion: string): Promise<IStudyDataVersion | null> {
        const newDataVersionId = uuid();
        const newContentId = uuid();
        const resData = await db.collections!.data_collection.updateMany({
            m_studyId: studyId,
            m_versionId: null
        }, {
            $set: {
                m_versionId: newDataVersionId
            }
        });
        // if field is modified, need to modified the approved fields of each related project
        // if the field is updated: update the approved field Id
        // if the field is deleted: remove the original field Id
        const newApprovedFieldsInfo = await db.collections!.field_dictionary_collection.find({ studyId: studyId, dataVersion: null }).toArray();
        const fieldsToDelete: string[] = [];
        const fieldsToAdd: string[] = [];
        // delete all influenced fields and then add the new one
        const projects = await db.collections!.projects_collection.find({ studyId: studyId, deleted: null }).toArray();
        for (const project of projects) {
            const originalApprovedFieldsInfo = await db.collections!.field_dictionary_collection.find({ id: { $in: project.approvedFields } }).toArray();
            const originalApprovedFieldsIds = originalApprovedFieldsInfo.map(el => el.fieldId);
            for (const each of newApprovedFieldsInfo) {
                if (originalApprovedFieldsIds.includes(each.fieldId)) {
                    if (each.dateDeleted === null) {
                        // delete original and add new one
                        fieldsToDelete.push(originalApprovedFieldsInfo.filter(el => el.fieldId === each.fieldId)[0].id);
                        fieldsToAdd.push(each.id);
                    } else {
                        fieldsToDelete.push(originalApprovedFieldsInfo.filter(el => el.fieldId === each.fieldId)[0].id);
                    }
                }
            }
            await db.collections!.projects_collection.findOneAndUpdate({ studyId: project.studyId, id: project.id }, {
                $pull: {
                    approvedFields: {
                        $in: fieldsToDelete
                    }
                }
            });
            await db.collections!.projects_collection.findOneAndUpdate({ studyId: project.studyId, id: project.id }, {
                $push: {
                    approvedFields: {
                        $each: fieldsToAdd
                    }
                }
            });
        }

        const resField = await db.collections!.field_dictionary_collection.updateMany({
            studyId: studyId,
            dataVersion: null
        }, {
            $set: {
                dataVersion: newDataVersionId
            }
        });
        if (resData.modifiedCount === 0 && resField.modifiedCount === 0) {
            return null;
        }

        // insert a new version into study
        const newDataVersion: IStudyDataVersion = {
            id: newDataVersionId,
            contentId: newContentId, // same content = same id - used in reverting data, version control
            version: dataVersion,
            tag: tag,
            updateDate: (new Date().valueOf()).toString(),
        };
        await db.collections!.studies_collection.updateOne({ id: studyId }, {
            $push: { dataVersions: newDataVersion },
            $inc: {
                currentDataVersion: 1
            }
        });
        return newDataVersion;
    }

    public async uploadOneDataClip(studyId: string, fieldList: any[], data: any): Promise<any> {
        const errors: any[] = [];
        const bulk = db.collections!.data_collection.initializeUnorderedBulkOp();
        // remove duplicates by subjectId, visitId and fieldId
        const keysToCheck = ['visitId', 'subjectId', 'fieldId'];
        const filteredData = data.filter(
            (s => o => (k => !s.has(k) && s.add(k))(keysToCheck.map(k => o[k]).join('|')))(new Set())
        );
        for (const dataClip of filteredData) {
            const fieldInDb = fieldList.filter(el => el.fieldId === dataClip.fieldId)[0];
            if (!fieldInDb) {
                errors.push({ code: DATA_CLIP_ERROR_TYPE.ACTION_ON_NON_EXISTENT_ENTRY, description: `Field ${dataClip.fieldId}: Field Not found` });
                continue;
            }
            // check subjectId
            if (!validate(dataClip.subjectId?.replace('-', '').substr(1) ?? '')) {
                errors.push({ code: DATA_CLIP_ERROR_TYPE.MALFORMED_INPUT, description: `Subject ID ${dataClip.subjectId} is illegal.` });
                continue;
            }

            // check value is valid
            let error;
            let parsedValue;
            if (dataClip.value.toString() === '99999') { // agreement with other WPs, 99999 refers to missing
                parsedValue = '99999';
            } else {
                switch (fieldInDb.dataType) {
                    case 'dec': {// decimal
                        if (!/^\d+(.\d+)?$/.test(dataClip.value)) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as decimal.`;
                            break;
                        }
                        parsedValue = parseFloat(dataClip.value);
                        break;
                    }
                    case 'int': {// integer
                        if (!/^-?\d+$/.test(dataClip.value)) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as integer.`;
                            break;
                        }
                        parsedValue = parseInt(dataClip.value, 10);
                        break;
                    }
                    case 'bool': {// boolean
                        if (dataClip.value.toLowerCase() === 'true' || dataClip.value.toLowerCase() === 'false') {
                            parsedValue = dataClip.value.toLowerCase() === 'true';
                        } else {
                            error = `Field ${dataClip.fieldId}: Cannot parse as boolean.`;
                            break;
                        }
                        break;
                    }
                    case 'str': {
                        parsedValue = dataClip.value.toString();
                        break;
                    }
                    // 01/02/2021 00:00:00
                    case 'date': {
                        const matcher = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?/;
                        if (!dataClip.value.match(matcher)) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as data. Value for date type must be in ISO format.`;
                            break;
                        }
                        parsedValue = dataClip.value.toString();
                        break;
                    }
                    case 'json': {
                        parsedValue = dataClip.value;
                        break;
                    }
                    case 'file': {
                        const file = await db.collections!.files_collection.findOne({ id: parseValue });
                        if (!file) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as file or file does not exist.`;
                            break;
                        } else {
                            parsedValue = dataClip.value.toString();
                        }
                        break;
                    }
                    case 'cat': {
                        if (!fieldInDb.possibleValues.map(el => el.code).includes(dataClip.value.toString())) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as categorical, value not in value list.`;
                            break;
                        } else {
                            parsedValue = dataClip.value.toString();
                        }
                        break;
                    }
                    default: {
                        error = (`Field ${dataClip.fieldId}: Invalid data Type.`);
                        break;
                    }
                }
            }
            if (error !== undefined) {
                errors.push({ code: DATA_CLIP_ERROR_TYPE.MALFORMED_INPUT, description: error });
                continue;
            }
            const obj = {
                m_studyId: studyId,
                m_subjectId: dataClip.subjectId,
                m_versionId: undefined,
                m_visitId: dataClip.visitId,
            };
            const objWithData: MatchKeysAndValues<IDataEntry> = {
                ...obj,
                id: uuid(),
                uploadedAt: (new Date()).valueOf()
            };
            objWithData[dataClip.fieldId] = parsedValue;
            bulk.find(obj).upsert().updateOne({ $set: objWithData });
        }
        bulk.execute();
        return errors;
    }

    public async createProjectForStudy(studyId: string, projectName: string, requestedBy: string, approvedFields?: string[], approvedFiles?: string[]): Promise<IProject> {
        const project: IProject = {
            id: uuid(),
            dataVersion: null,
            studyId,
            createdBy: requestedBy,
            name: projectName,
            patientMapping: {},
            approvedFields: approvedFields ? approvedFields : [],
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
        const session = db.client!.startSession();
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
        const timestamp = new Date().valueOf();

        /* delete all projects related to the study */
        await db.collections!.projects_collection.findOneAndUpdate({ id: projectId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } }, { returnDocument: 'after' });

        /* delete all roles related to the study */
        await this.localPermissionCore.removeRoleFromStudyOrProject({ projectId });
    }

    public async editProjectApprovedFields(projectId: string, approvedFields: string[]): Promise<IProject> {
        /* PRECONDITION: assuming all the fields to add exist (no need for the same for remove because it just pulls whatever)*/
        const result = await db.collections!.projects_collection.findOneAndUpdate({ id: projectId }, { $set: { approvedFields: approvedFields } }, { returnDocument: 'after' });
        if (result.ok === 1 && result.value) {
            return result.value as IProject;
        } else {
            throw new ApolloError(`Cannot update project "${projectId}"`, errorCodes.DATABASE_ERROR);
        }
    }

    public async editProjectApprovedFiles(projectId: string, approvedFiles: string[]): Promise<IProject> {
        /* PRECONDITION: assuming all the fields to add exist (no need for the same for remove because it just pulls whatever)*/
        const result = await db.collections!.projects_collection.findOneAndUpdate({ id: projectId }, { $set: { approvedFiles } }, { returnDocument: 'after' });
        if (result.ok === 1 && result.value) {
            return result.value as IProject;
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

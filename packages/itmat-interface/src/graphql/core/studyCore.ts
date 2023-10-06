import { GraphQLError } from 'graphql';
import { IFile, IUser, IProject, IStudy, studyType, IStudyDataVersion, IDataEntry, IDataClip, IRole, IFieldEntry, deviceTypes, IOrganisation } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';
import { PermissionCore, permissionCore, translateCohort } from './permissionCore';
import { validate } from '@ideafast/idgen';
import type { MatchKeysAndValues } from 'mongodb';
import { objStore } from '../../objStore/objStore';
import { FileUpload } from 'graphql-upload-minimal';
import crypto from 'crypto';
import { fileSizeLimit } from '../../utils/definition';
import { IGenericResponse } from '../responses';
export class StudyCore {
    constructor(private readonly localPermissionCore: PermissionCore) { }

    public async findOneStudy_throwErrorIfNotExist(studyId: string): Promise<IStudy> {
        const studySearchResult = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null })!;
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new GraphQLError('Study does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        return studySearchResult;
    }

    public async findOneProject_throwErrorIfNotExist(projectId: string): Promise<IProject> {
        const projectSearchResult = await db.collections!.projects_collection.findOne({ id: projectId, deleted: null })!;
        if (projectSearchResult === null || projectSearchResult === undefined) {
            throw new GraphQLError('Project does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
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
            throw new GraphQLError(`Study "${studyName}" already exists (duplicates are case-insensitive).`);
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
            type: type,
            ontologyTrees: [],
            metadata: {}
        };
        await db.collections!.studies_collection.insertOne(study);
        return study;
    }

    public async editStudy(studyId: string, description: string): Promise<IStudy> {
        const res = await db.collections!.studies_collection.findOneAndUpdate({ id: studyId }, { $set: { description: description } }, { returnDocument: 'after' });
        if (res) {
            return res;
        } else {
            throw new GraphQLError('Edit study failed');
        }
    }

    public async createNewDataVersion(studyId: string, tag: string, dataVersion: string): Promise<IStudyDataVersion | null> {
        const newDataVersionId = uuid();
        const newContentId = uuid();

        // update data
        const resData = await db.collections!.data_collection.updateMany({
            m_studyId: studyId,
            m_versionId: null
        }, {
            $set: {
                m_versionId: newDataVersionId
            }
        });
        // update field
        const resField = await db.collections!.field_dictionary_collection.updateMany({
            studyId: studyId,
            dataVersion: null
        }, {
            $set: {
                dataVersion: newDataVersionId
            }
        });
        // update standardization
        const resStandardization = await db.collections!.standardizations_collection.updateMany({
            studyId: studyId,
            dataVersion: null
        }, {
            $set: {
                dataVersion: newDataVersionId
            }
        });

        // update ontology trees
        const resOntologyTrees = await db.collections!.studies_collection.updateOne({ 'id': studyId, 'deleted': null, 'ontologyTrees.dataVersion': null }, {
            $set: {
                'ontologyTrees.$.dataVersion': newDataVersionId
            }
        });

        if (resData.modifiedCount === 0 && resField.modifiedCount === 0 && resStandardization.modifiedCount === 0 && resOntologyTrees.modifiedCount === 0) {
            return null;
        }



        // update permissions based on roles
        const roles = await db.collections!.roles_collection.find<IRole>({ studyId: studyId, deleted: null }).toArray();
        for (const role of roles) {
            const filters: Record<string, string[]> = {
                subjectIds: role.permissions.data?.subjectIds || [],
                visitIds: role.permissions.data?.visitIds || [],
                fieldIds: role.permissions.data?.fieldIds || []
            };
            // deal with data filters
            let validSubjects: Array<string | RegExp> | null = null;
            if (role.permissions.data?.filters) {
                if (role.permissions.data.filters.length > 0) {
                    validSubjects = [];
                    const subqueries = translateCohort(role.permissions.data.filters);
                    validSubjects = (await db.collections!.data_collection.aggregate([{
                        $match: { $and: subqueries }
                    }]).toArray()).map(el => el.m_subjectId);
                }
            }
            if (validSubjects === null) {
                validSubjects = [/^.*$/];
            }
            const tag = `metadata.${'role:'.concat(role.id)}`;
            await db.collections!.data_collection.updateMany({
                m_studyId: studyId,
                m_versionId: newDataVersionId,
                $and: [
                    { m_subjectId: { $in: filters.subjectIds.map((el: string) => new RegExp(el)) } },
                    { m_subjectId: { $in: validSubjects } }
                ],
                m_visitId: { $in: filters.visitIds.map((el: string) => new RegExp(el)) },
                m_fieldId: { $in: filters.fieldIds.map((el: string) => new RegExp(el)) }
            }, {
                $set: { [tag]: true }
            });
            await db.collections!.data_collection.updateMany({
                m_studyId: studyId,
                m_versionId: newDataVersionId,
                $or: [
                    { m_subjectId: { $nin: filters.subjectIds.map((el: string) => new RegExp(el)) } },
                    { m_subjectId: { $nin: validSubjects } },
                    { m_visitId: { $nin: filters.visitIds.map((el: string) => new RegExp(el)) } },
                    { m_fieldId: { $nin: filters.fieldIds.map((el: string) => new RegExp(el)) } }
                ]
            }, {
                $set: { [tag]: false }
            });
            await db.collections!.field_dictionary_collection.updateMany({
                studyId: studyId,
                dataVersion: newDataVersionId,
                fieldId: { $in: filters.fieldIds.map((el: string) => new RegExp(el)) }
            }, {
                $set: { [tag as any]: true }
            });
            await db.collections!.field_dictionary_collection.updateMany({
                studyId: studyId,
                dataVersion: newDataVersionId,
                fieldId: { $nin: filters.fieldIds.map((el: string) => new RegExp(el)) }
            }, {
                $set: { [tag as any]: false }
            });
        }

        // insert a new version into study
        const newDataVersion: IStudyDataVersion = {
            id: newDataVersionId,
            contentId: newContentId, // same content = same id - used in reverting data, version control
            version: dataVersion,
            tag: tag,
            updateDate: (new Date().valueOf()).toString()
        };
        await db.collections!.studies_collection.updateOne({ id: studyId }, {
            $push: { dataVersions: newDataVersion },
            $inc: {
                currentDataVersion: 1
            }
        });
        return newDataVersion;
    }

    public async uploadOneDataClip(studyId: string, permissions: any, fieldList: Partial<IFieldEntry>[], data: IDataClip[], requester: IUser): Promise<any> {
        const response: IGenericResponse[] = [];
        let bulk = db.collections!.data_collection.initializeUnorderedBulkOp();
        // remove duplicates by subjectId, visitId and fieldId
        const keysToCheck: Array<keyof IDataClip> = ['visitId', 'subjectId', 'fieldId'];
        const filteredData = data.filter(
            (s => o => (k => !s.has(k) && s.add(k))(keysToCheck.map(k => o[k]).join('|')))(new Set())
        );
        for (const dataClip of filteredData) {
            // remove the '-' if there exists
            dataClip.subjectId = dataClip.subjectId.replace('-', '');
            const fieldInDb = fieldList.filter(el => el.fieldId === dataClip.fieldId)[0];
            if (!fieldInDb) {
                response.push({ successful: false, code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, description: `Field ${dataClip.fieldId}: Field Not found` });
                continue;
            }
            // check subjectId
            if (!validate(dataClip.subjectId.substr(1) ?? '')) {
                response.push({ successful: false, code: errorCodes.CLIENT_MALFORMED_INPUT, description: `Subject ID ${dataClip.subjectId} is illegal.` });
                continue;
            }
            if (!(await permissionCore.checkDataEntryValid(permissions, dataClip.fieldId, dataClip.subjectId, dataClip.visitId))) {
                response.push({ successful: false, code: errorCodes.NO_PERMISSION_ERROR, description: 'You do not have access to this field.' });
                continue;
            }
            // check value is valid
            let error;
            let parsedValue;
            if (dataClip.value?.toString() === '99999') { // agreement with other WPs, 99999 refers to missing
                parsedValue = '99999';
            } else {
                switch (fieldInDb.dataType) {
                    case 'dec': {// decimal
                        if (typeof (dataClip.value) !== 'string') {
                            error = `Field ${dataClip.fieldId}: Cannot parse as decimal.`;
                            break;
                        }
                        if (!/^\d+(.\d+)?$/.test(dataClip.value)) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as decimal.`;
                            break;
                        }
                        parsedValue = parseFloat(dataClip.value);
                        break;
                    }
                    case 'int': {// integer
                        if (typeof (dataClip.value) !== 'string') {
                            error = `Field ${dataClip.fieldId}: Cannot parse as integer.`;
                            break;
                        }
                        if (!/^-?\d+$/.test(dataClip.value)) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as integer.`;
                            break;
                        }
                        parsedValue = parseInt(dataClip.value, 10);
                        break;
                    }
                    case 'bool': {// boolean
                        if (typeof (dataClip.value) !== 'string') {
                            error = `Field ${dataClip.fieldId}: Cannot parse as boolean.`;
                            break;
                        }
                        if (dataClip.value.toLowerCase() === 'true' || dataClip.value.toLowerCase() === 'false') {
                            parsedValue = dataClip.value.toLowerCase() === 'true';
                        } else {
                            error = `Field ${dataClip.fieldId}: Cannot parse as boolean.`;
                            break;
                        }
                        break;
                    }
                    case 'str': {
                        if (typeof (dataClip.value) !== 'string') {
                            error = `Field ${dataClip.fieldId}: Cannot parse as string.`;
                            break;
                        }
                        parsedValue = dataClip.value.toString();
                        break;
                    }
                    // 01/02/2021 00:00:00
                    case 'date': {
                        if (typeof (dataClip.value) !== 'string') {
                            error = `Field ${dataClip.fieldId}: Cannot parse as data. Value for date type must be in ISO format.`;
                            break;
                        }
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
                        if (!dataClip.file || typeof (dataClip.file) === 'string') {
                            error = `Field ${dataClip.fieldId}: Cannot parse as file.`;
                            break;
                        }
                        // if old file exists, delete it first
                        const res = await this.uploadFile(studyId, dataClip, requester, {});
                        if ('code' in res && 'description' in res) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as file.`;
                            break;
                        } else {
                            parsedValue = res.id;
                        }
                        break;
                    }
                    case 'cat': {
                        if (!fieldInDb.possibleValues) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as categorical, possible values not defined.`;
                            break;
                        }
                        if (!fieldInDb.possibleValues.map((el: any) => el.code).includes(dataClip.value?.toString())) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as categorical, value not in value list.`;
                            break;
                        } else {
                            parsedValue = dataClip.value?.toString();
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
                response.push({ successful: false, code: errorCodes.CLIENT_MALFORMED_INPUT, description: error });
                continue;
            } else {
                response.push({ successful: true, description: `${dataClip.subjectId}-${dataClip.visitId}-${dataClip.fieldId}` });
            }
            const obj = {
                m_studyId: studyId,
                m_versionId: null,
                m_subjectId: dataClip.subjectId,
                m_visitId: dataClip.visitId,
                m_fieldId: dataClip.fieldId
            };
            let objWithData: Partial<MatchKeysAndValues<IDataEntry>>;
            // update the file data differently
            if (fieldInDb.dataType === 'file') {
                const existing = await db.collections!.data_collection.findOne(obj);
                if (!existing) {
                    await db.collections!.data_collection.insertOne({
                        ...obj,
                        id: uuid(),
                        uploadedAt: (new Date()).valueOf(),
                        value: '',
                        metadata: {
                            add: [],
                            remove: []
                        }
                    });
                }

                objWithData = {
                    ...obj,
                    id: uuid(),
                    value: '',
                    uploadedAt: (new Date()).valueOf(),
                    metadata: {
                        ...dataClip.metadata,
                        participantId: dataClip.subjectId,
                        add: ((existing?.metadata as any)?.add || []).concat(parsedValue),
                        uploader: requester.id
                    },
                    uploadedBy: requester.id
                };
                bulk.find(obj).updateOne({ $set: objWithData });
            } else {
                objWithData = {
                    ...obj,
                    id: uuid(),
                    value: parsedValue,
                    uploadedAt: (new Date()).valueOf(),
                    metadata: {
                        ...dataClip.metadata,
                        uploader: requester.id
                    },
                    uploadedBy: requester.id
                };
                bulk.insert(objWithData);
            }
            if (bulk.batches.length > 999) {
                await bulk.execute();
                bulk = db.collections!.data_collection.initializeUnorderedBulkOp();
            }
        }
        bulk.batches.length !== 0 && await bulk.execute();
        return response;
    }

    // This file uploading function will not check any metadate of the file
    public async uploadFile(studyId: string, data: IDataClip, uploader: IUser, args: { fileLength?: number, fileHash?: string }): Promise<IFile | { code: errorCodes, description: string }> {
        if (!data.file || typeof (data.file) === 'string') {
            return { code: errorCodes.CLIENT_MALFORMED_INPUT, description: 'Invalid File Stream' };
        }
        const study = await db.collections!.studies_collection.findOne({ id: studyId });
        if (!study) {
            return { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, description: 'Study does not exist.' };
        }
        const sitesIDMarkers = (await db.collections!.organisations_collection.find<IOrganisation>({ deleted: null }).toArray()).reduce<any>((acc, curr) => {
            if (curr.metadata?.siteIDMarker) {
                acc[curr.metadata.siteIDMarker] = curr.shortname;
            }
            return acc;
        }, {});
        // check file metadata
        if (data.metadata) {
            let parsedDescription: Record<string, any>;
            let startDate;
            let endDate;
            let deviceId;
            let participantId;
            try {
                parsedDescription = data.metadata;
                startDate = parseInt(parsedDescription.startDate);
                endDate = parseInt(parsedDescription.endDate);
                participantId = data.subjectId.toString();
                deviceId = parsedDescription.deviceId.toString();
            } catch (e) {
                return { code: errorCodes.CLIENT_MALFORMED_INPUT, description: 'File description is invalid' };
            }
            if (
                !Object.keys(sitesIDMarkers).includes(participantId.substr(0, 1)?.toUpperCase()) ||
                !Object.keys(deviceTypes).includes(deviceId.substr(0, 3)?.toUpperCase()) ||
                !validate(participantId.substr(1) ?? '') ||
                !validate(deviceId.substr(3) ?? '') ||
                !startDate || !endDate ||
                (new Date(endDate).setHours(0, 0, 0, 0).valueOf()) > (new Date().setHours(0, 0, 0, 0).valueOf())
            ) {
                return { code: errorCodes.CLIENT_MALFORMED_INPUT, description: 'File description is invalid' };
            }
        } else {
            return { code: errorCodes.CLIENT_MALFORMED_INPUT, description: 'File description is invalid' };
        }


        const file: FileUpload = await data.file;

        // check if old files exist; if so, denote it as deleted
        const dataEntry = await db.collections!.data_collection.findOne({ m_studyId: studyId, m_visitId: data.visitId, m_subjectId: data.subjectId, m_versionId: null, m_fieldId: data.fieldId });
        const oldFileId = dataEntry ? dataEntry.value : null;
        return new Promise<IFile>((resolve, reject) => {

            (async () => {
                try {
                    const fileEntry: Partial<IFile> = {
                        id: uuid(),
                        fileName: file.filename,
                        studyId: studyId,
                        description: JSON.stringify({}),
                        uploadTime: `${Date.now()}`,
                        uploadedBy: uploader.id,
                        deleted: null,
                        metadata: (data.metadata as Record<string, any>)
                    };

                    if (args.fileLength !== undefined && args.fileLength > fileSizeLimit) {
                        reject(new GraphQLError('File should not be larger than 8GB', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                        return;
                    }

                    const stream = file.createReadStream();
                    const fileUri = uuid();
                    const hash = crypto.createHash('sha256');
                    let readBytes = 0;

                    stream.pause();

                    /* if the client cancelled the request mid-stream it will throw an error */
                    stream.on('error', (e) => {
                        reject(new GraphQLError('Upload resolver file stream failure', { extensions: { code: errorCodes.FILE_STREAM_ERROR, error: e } }));
                        return;
                    });

                    stream.on('data', (chunk) => {
                        readBytes += chunk.length;
                        if (readBytes > fileSizeLimit) {
                            stream.destroy();
                            reject(new GraphQLError('File should not be larger than 8GB', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                            return;
                        }
                        hash.update(chunk);
                    });


                    await objStore.uploadFile(stream, studyId, fileUri);

                    // hash is optional, but should be correct if provided
                    const hashString = hash.digest('hex');
                    if (args.fileHash && args.fileHash !== hashString) {
                        reject(new GraphQLError('File hash not match', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                        return;
                    }

                    // check if readbytes equal to filelength in parameters
                    if (args.fileLength !== undefined && args.fileLength.toString() !== readBytes.toString()) {
                        reject(new GraphQLError('File size mismatch', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } }));
                        return;
                    }

                    fileEntry.fileSize = readBytes.toString();
                    fileEntry.uri = fileUri;
                    fileEntry.hash = hashString;
                    const insertResult = await db.collections!.files_collection.insertOne(fileEntry as IFile);
                    if (insertResult.acknowledged) {
                        // delete old file if existing
                        await db.collections!.files_collection.findOneAndUpdate({ studyId: studyId, id: oldFileId }, { $set: { deleted: Date.now().valueOf() } });
                        resolve(fileEntry as IFile);
                    } else {
                        throw new GraphQLError(errorCodes.DATABASE_ERROR);
                    }
                }
                catch (error) {
                    reject({ code: errorCodes.CLIENT_MALFORMED_INPUT, description: 'Missing file metadata.', error });
                    return;
                }
            })();
        });
    }

    public async createProjectForStudy(studyId: string, projectName: string, requestedBy: string): Promise<IProject> {
        const project: IProject = {
            id: uuid(),
            studyId,
            createdBy: requestedBy,
            name: projectName,
            patientMapping: {},
            lastModified: new Date().valueOf(),
            deleted: null,
            metadata: {}
        };

        const getListOfPatientsResult = await db.collections!.data_collection.aggregate([
            { $match: { m_studyId: studyId } },
            { $group: { _id: null, array: { $addToSet: '$m_subjectId' } } },
            { $project: { array: 1 } }
        ]).toArray();

        if (getListOfPatientsResult === null || getListOfPatientsResult === undefined) {
            throw new GraphQLError('Cannot get list of patients', { extensions: { code: errorCodes.DATABASE_ERROR } });
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
            await db.collections!.files_collection.updateMany({ studyId, deleted: null }, { $set: { deleted: timestamp } });

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

    private createPatientIdMapping(listOfPatientId: string[], prefix?: string): { [originalPatientId: string]: string } {
        let rangeArray: Array<string | number> = [...Array.from(listOfPatientId.keys())];
        if (prefix === undefined) {
            prefix = uuid().substring(0, 10);
        }
        rangeArray = rangeArray.map((e) => `${prefix}${e} `);
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

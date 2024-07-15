import { GraphQLError } from 'graphql';
import { IFile, IProject, IStudy, studyType, IStudyDataVersion, IDataClip, IRole, IField, deviceTypes, IUserWithoutToken, enumUserTypes, IOntologyTree, IQueryString, IGroupedData, enumFileTypes, enumFileCategories, enumDataTypes, ICategoricalOption, permissionString, enumDataAtomicPermissions, IData, enumStudyRoles } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { errorCodes } from '../utils/errors';
import { PermissionCore } from './permissionCore';
import { validate } from '@ideafast/idgen';
import type { Filter } from 'mongodb';
import { FileUpload } from 'graphql-upload-minimal';
import crypto from 'crypto';
import { fileSizeLimit } from '../utils/definition';
import { IGenericResponse, makeGenericReponse } from '../utils/responses';
import { buildPipeline, dataStandardization } from '../utils/query';
import { DBType } from '../database/database';
import { ObjectStore } from '@itmat-broker/itmat-commons';

enum enumV2DataType {
    'INT' = 'int',
    'DEC' = 'dec',
    'STR' = 'str',
    'BOOL' = 'bool',
    'DATE' = 'date',
    'FILE' = 'file',
    'JSON' = 'json',
    'CAT' = 'cat'
}

export interface CreateFieldInput {
    fieldId: string;
    fieldName: string
    tableName?: string
    dataType: enumV2DataType;
    possibleValues?: ICategoricalOption[]
    unit?: string
    comments?: string
    metadata?: Record<string, unknown>
}

export interface EditFieldInput {
    fieldId: string;
    fieldName: string;
    tableName?: string;
    dataType: enumV2DataType;
    possibleValues?: ICategoricalOption[]
    unit?: string
    comments?: string
}

export class StudyCore {
    db: DBType;
    permissionCore: PermissionCore;
    objStore: ObjectStore;
    constructor(db: DBType, objStore: ObjectStore) {
        this.db = db;
        this.permissionCore = new PermissionCore(db);
        this.objStore = objStore;
    }

    public async findOneStudy_throwErrorIfNotExist(studyId: string): Promise<IStudy> {
        const studySearchResult = await this.db.collections.studies_collection.findOne({ id: studyId, deleted: null });
        if (studySearchResult === null || studySearchResult === undefined) {
            throw new GraphQLError('Study does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        return studySearchResult;
    }

    public async findOneProject_throwErrorIfNotExist(projectId: string): Promise<IProject> {
        const projectSearchResult = await this.db.collections.projects_collection.findOne({ id: projectId, deleted: null });
        if (projectSearchResult === null || projectSearchResult === undefined) {
            throw new GraphQLError('Project does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        return projectSearchResult;
    }

    public async getStudy(requester: IUserWithoutToken | undefined, studyId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* user can get study if he has readonly permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (requester.type !== enumUserTypes.ADMIN && !roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (study === null || study === undefined) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return {
            ...study,
            createdBy: study.life.createdUser,
            deleted: study.life.deletedTime
        };
    }

    public async getProject(requester: IUserWithoutToken | undefined, projectId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        /* get project */ // defer patientMapping since it's costly and not available to all users
        const project = await this.db.collections.projects_collection.findOne({ id: projectId, deleted: null }, { projection: { patientMapping: 0 } });
        if (!project)
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);

        /* check if user has permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, project.studyId);
        if (requester.type !== enumUserTypes.ADMIN && !roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        return project;
    }

    /**
     * This function convert the new field type to the old ones for consistency with the GraphQL schema
     */
    public fieldTypeConverter(fields: IField[]) {
        return fields.map((field) => {
            return {
                ...field,
                possibleValues: field.categoricalOptions ? field.categoricalOptions.map((el) => {
                    return {
                        id: el.id,
                        code: el.code,
                        description: el.description,
                        life: {
                            createdTime: el.life.createdTime,
                            createdUser: el.life.createdUser,
                            deletedTime: el.life.deletedTime,
                            deletedUser: el.life.deletedUser
                        },
                        metadata: {}
                    };
                }) : [],
                dataType: (() => {
                    if (field.dataType === enumDataTypes.INTEGER) {
                        return enumV2DataType.INT;
                    } else if (field.dataType === enumDataTypes.DECIMAL) {
                        return enumV2DataType.DEC;
                    } else if (field.dataType === enumDataTypes.STRING) {
                        return enumV2DataType.STR;
                    } else if (field.dataType === enumDataTypes.BOOLEAN) {
                        return enumV2DataType.BOOL;
                    } else if (field.dataType === enumDataTypes.DATETIME) {
                        return enumV2DataType.DATE;
                    } else if (field.dataType === enumDataTypes.FILE) {
                        return enumV2DataType.FILE;
                    } else if (field.dataType === enumDataTypes.JSON) {
                        return enumV2DataType.JSON;
                    } else if (field.dataType === enumDataTypes.CATEGORICAL) {
                        return enumV2DataType.CAT;
                    } else {
                        return enumV2DataType.STR;
                    }
                })(),
                dateAdded: field.life.createdTime.toString(),
                dateDeleted: field.life.deletedTime ? field.life.deletedTime.toString() : null
            };
        });
    }

    public async getStudyFields(requester: IUserWithoutToken | undefined, studyId: string, versionId?: string | null) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* user can get study if he has readonly permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }
        const study = await this.findOneStudy_throwErrorIfNotExist(studyId);

        // the processes of requiring versioned data and unversioned data are different
        // check the metadata:role:**** for versioned data directly
        const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        if (versionId === null) {
            availableDataVersions.push(null);
        }
        const matchFilter: Filter<IField>[] = [];
        for (const role of roles) {
            for (const dataPermission of role.dataPermissions) {
                if (permissionString[enumDataAtomicPermissions.READ].includes(dataPermission.permission)) {
                    for (const re of dataPermission.fields) {
                        matchFilter.push({ fieldId: { $regex: re }, dataVersion: { $in: availableDataVersions } });
                    }
                }
            }
        }
        const fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IField>([{
            $match: { $or: matchFilter }
        }, {
            $sort: { 'life.createdTime': -1 }
        }, {
            $group: {
                _id: '$fieldId',
                doc: { $first: '$$ROOT' }
            }
        }, {
            $replaceRoot: {
                newRoot: '$doc'
            }
        }, {
            $sort: { fieldId: 1 }
        }]).toArray();
        return this.fieldTypeConverter(fieldRecords.filter(el => el.life.deletedTime === null));
        return [];
    }

    public async getOntologyTree(requester: IUserWithoutToken | undefined, studyId: string, projectId?: string, treeName?: string, versionId?: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        /* get studyId by parameter or project */
        const study = await this.findOneStudy_throwErrorIfNotExist(studyId);
        if (projectId) {
            await this.findOneProject_throwErrorIfNotExist(projectId);
        }

        // we dont filters fields of an ontology tree by fieldIds
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (requester.type !== enumUserTypes.ADMIN && !roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        // if versionId is null, we will only return trees whose data version is null
        // this is a different behavior from getting fields or data
        if (study.ontologyTrees === undefined) {
            return [];
        } else {
            const trees: IOntologyTree[] = study.ontologyTrees;
            if (versionId === null) {
                const availableTrees: IOntologyTree[] = [];
                for (let i = trees.length - 1; i >= 0; i--) {
                    if (trees[i].dataVersion === null
                        && availableTrees.filter(el => el.name === trees[i].name).length === 0) {
                        availableTrees.push(trees[i]);
                    } else {
                        continue;
                    }
                }
                if (treeName) {
                    return availableTrees.filter(el => el.name === treeName);
                } else {
                    return availableTrees;
                }
            } else {
                const availableTrees: IOntologyTree[] = [];
                for (let i = trees.length - 1; i >= 0; i--) {
                    if (availableDataVersions.includes(trees[i].dataVersion || '')
                        && availableTrees.filter(el => el.name === trees[i].name).length === 0) {
                        availableTrees.push(trees[i]);
                    } else {
                        continue;
                    }
                }
                if (treeName) {
                    return availableTrees.filter(el => el.name === treeName);
                } else {
                    return availableTrees;
                }
            }
        }
    }

    public async getDataRecords(requester: IUserWithoutToken | undefined, queryString: IQueryString, studyId: string, versionId: string | null | undefined) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        /* user can get study if he has readonly permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (requester.type !== enumUserTypes.ADMIN && !roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        const study = await this.findOneStudy_throwErrorIfNotExist(studyId);

        let availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        let fieldRecords: IField[] = [];
        let result;
        // we obtain the data by different requests
        // admin used will not filtered by metadata filters
        if (versionId !== undefined) {
            if (versionId === null) {
                availableDataVersions.push(null);
            } else if (versionId === '-1') {
                availableDataVersions = availableDataVersions.length !== 0 ? [availableDataVersions[availableDataVersions.length - 1]] : [];
            } else {
                availableDataVersions = [versionId];
            }
        }
        if (requester.type === enumUserTypes.ADMIN) {
            fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IField>([{
                $match: { studyId: studyId, dataVersion: { $in: availableDataVersions } }
            }, {
                $sort: { 'life.createdTime': -1 }
            }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $first: '$$ROOT' }
                }
            }, {
                $replaceRoot: {
                    newRoot: '$doc'
                }
            }, {
                $sort: { fieldId: 1 }
            }]).toArray();
            if (queryString.data_requested && queryString.data_requested.length > 0) {
                fieldRecords = fieldRecords.filter(el => (queryString.data_requested || []).includes(el.fieldId));
            }
            const pipeline = buildPipeline(studyId, roles, fieldRecords, availableDataVersions, queryString.data_requested ?? []);
            result = await this.db.collections.data_collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
        } else {
            const matchFilter: Filter<IField>[] = [];
            for (const role of roles) {
                for (const dataPermission of role.dataPermissions) {
                    if (permissionString[enumDataAtomicPermissions.READ].includes(dataPermission.permission)) {
                        for (const re of dataPermission.fields) {
                            matchFilter.push({ fieldId: { $regex: re }, dataVersion: { $in: availableDataVersions } });
                        }
                    }
                }
            }
            fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IField>([{
                $match: { $or: matchFilter }
            }, {
                $sort: { 'life.createdTime': -1 }
            }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $first: '$$ROOT' }
                }
            }, {
                $replaceRoot: {
                    newRoot: '$doc'
                }
            }, {
                $sort: { fieldId: 1 }
            }]).toArray();
            const pipeline = buildPipeline(studyId, roles, fieldRecords, availableDataVersions, queryString.data_requested ?? []);
            result = await this.db.collections.data_collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
        }
        // post processing the data
        // The following code is used for IDEAFAST data type only, use trpc APIs for other datasets
        const groupedResult: IGroupedData = {};
        for (let i = 0; i < result.length; i++) {
            const { m_subjectId, m_visitId } = result[i].properties;
            const { fieldId, value } = result[i];
            if (!groupedResult[m_subjectId]) {
                groupedResult[m_subjectId] = {};
            }
            if (!groupedResult[m_subjectId][m_visitId]) {
                groupedResult[m_subjectId][m_visitId] = {};
            }
            groupedResult[m_subjectId][m_visitId][fieldId] = value;
        }
        // 2. adjust format: 1) original(exists) 2) standardized - $name 3) grouped
        // when standardized data, versionId should not be specified
        const standardizations = versionId === null ? null : await this.db.collections.standardizations_collection.find({ 'studyId': studyId, 'type': queryString['format'].split('-')[1], 'life.deletedTime': null, 'dataVersion': { $in: availableDataVersions } }).toArray();
        const formattedData = dataStandardization(study, fieldRecords,
            groupedResult, queryString, standardizations);
        return { data: formattedData };
    }

    public async getStudyProjects(study: IStudy) {
        return await this.db.collections.projects_collection.find({ studyId: study.id, deleted: null }).toArray();
    }

    public async getStudyJobs(study: IStudy) {
        return await this.db.collections.jobs_collection.find({ studyId: study.id }).toArray();
    }

    public async getStudyRoles(study: IStudy) {
        return await this.db.collections.roles_collection.find({ studyId: study.id, projectId: undefined, deleted: null }).toArray();
    }

    public async getStudyFiles(requester: IUserWithoutToken | undefined, study: IStudy) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, study.id);

        if (!roles.length) { return []; }

        const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        availableDataVersions.push(null);
        let fieldRecords: IField[] = [];
        let dataRecords: IData[] = [];

        const matchFilter: Filter<IField>[] = [];
        for (const role of roles) {
            for (const dataPermission of role.dataPermissions) {
                if (permissionString[enumDataAtomicPermissions.READ].includes(dataPermission.permission)) {
                    for (const re of dataPermission.fields) {
                        matchFilter.push({ fieldId: { $regex: re }, dataVersion: { $in: availableDataVersions } });
                    }
                }
            }
        }
        fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IField>([{
            $match: { $or: matchFilter, dataType: enumDataTypes.FILE }
        }, {
            $sort: { 'life.createdTime': -1 }
        }, {
            $group: {
                _id: '$fieldId',
                doc: { $first: '$$ROOT' }
            }
        }, {
            $replaceRoot: {
                newRoot: '$doc'
            }
        }, {
            $sort: { fieldId: 1 }
        }]).toArray();
        const pipeline = buildPipeline(study.id, roles, fieldRecords, availableDataVersions);
        dataRecords = await this.db.collections.data_collection.aggregate<IData>(pipeline, { allowDiskUse: true }).toArray();
        const files = await this.db.collections.files_collection.find({ id: { $in: dataRecords.map(el => String(el.value)) } }).toArray();
        return files.map(el => {
            return {
                ...el,
                uploadTime: el.life.createdTime,
                uploadedBy: el.life.createdUser
            };
        });
    }

    public async getStudySubjects(requester: IUserWithoutToken | undefined, study: IStudy) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, study.id);
        if (!roles.length) {
            return [[], []];
        }
        return [[], []];
    }

    public async getStudyVisits(requester: IUserWithoutToken | undefined, study: IStudy) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, study.id);
        if (!roles.length) {
            return [[], []];
        }
        return [[], []];
    }

    public async getStudyNumOfRecords(requester: IUserWithoutToken | undefined, study: IStudy) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, study.id);
        if (!roles.length) {
            return [0, 0];
        }
        return [0, 0];
    }

    public async getStudyCurrentDataVersion(study: IStudy) {
        return study.currentDataVersion === -1 ? null : study.currentDataVersion;
    }

    public async getProjectFields(requester: IUserWithoutToken | undefined, project: Omit<IProject, 'patientMapping'>) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, project.studyId);
        if (!roles.length) {
            return [];
        }
        return [];
    }

    public async getProjectJobs(project: Omit<IProject, 'patientMapping'>) {
        return await this.db.collections.jobs_collection.find({ studyId: project.studyId, projectId: project.id }).toArray();
    }

    public async getProjectFiles(requester: IUserWithoutToken | undefined, project: Omit<IProject, 'patientMapping'>) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const study = await this.db.collections.studies_collection.findOne({ id: project.studyId });
        if (!study) {
            return [];
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, study.id);

        if (requester.type !== enumUserTypes.ADMIN && !roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        availableDataVersions.push(null);
        let fieldRecords: IField[] = [];
        let dataRecords: IData[] = [];

        if (requester.type === enumUserTypes.ADMIN) {
            fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IField>([{
                $match: { studyId: study.id, dataVersion: { $in: availableDataVersions } }
            }, {
                $sort: { 'life.createdTime': -1 }
            }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $first: '$$ROOT' }
                }
            }, {
                $replaceRoot: {
                    newRoot: '$doc'
                }
            }, {
                $sort: { fieldId: 1 }
            }]).toArray();
            const pipeline = buildPipeline(study.id, roles, fieldRecords, availableDataVersions);
            dataRecords = await this.db.collections.data_collection.aggregate<IData>(pipeline, { allowDiskUse: true }).toArray();
        } else {
            const matchFilter: Filter<IField>[] = [];
            for (const role of roles) {
                for (const dataPermission of role.dataPermissions) {
                    if (permissionString[enumDataAtomicPermissions.READ].includes(dataPermission.permission)) {
                        for (const re of dataPermission.fields) {
                            matchFilter.push({ fieldId: { $regex: re }, dataVersion: { $in: availableDataVersions } });
                        }
                    }
                }
            }
            fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IField>([{
                $match: { $or: matchFilter }
            }, {
                $sort: { 'life.createdTime': -1 }
            }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $first: '$$ROOT' }
                }
            }, {
                $replaceRoot: {
                    newRoot: '$doc'
                }
            }, {
                $sort: { fieldId: 1 }
            }]).toArray();
            const pipeline = buildPipeline(study.id, roles, fieldRecords, availableDataVersions);
            dataRecords = await this.db.collections.data_collection.aggregate<IData>(pipeline, { allowDiskUse: true }).toArray();
        }
        return await this.db.collections.files_collection.find({ id: { $in: dataRecords.map(el => String(el.value)) } }).toArray();
    }

    public async getProjectDataVersion(project: IProject) {
        const study = await this.db.collections.studies_collection.findOne({ id: project.studyId, deleted: null });
        if (study === undefined || study === null) {
            return null;
        }
        if (study.currentDataVersion === -1) {
            return null;
        }
        return study.dataVersions[study?.currentDataVersion];
    }

    public async getProjectSummary(requester: IUserWithoutToken | undefined, project: IProject) {
        const summary = {};
        const study = await this.db.collections.studies_collection.findOne({ id: project.studyId });
        if (study === undefined || study === null || study.currentDataVersion === -1) {
            return summary;
        }
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* user can get study if he has readonly permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, project.studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }
        summary['subjects'] = [];
        summary['visits'] = [];
        summary['standardizationTypes'] = [];
        return summary;
    }

    public async getProjectPatientMapping(requester: IUserWithoutToken | undefined, project: IProject) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, project.studyId);
        if (!roles.length) {
            return null;
        }

        /* returning */
        const result =
            await this.db.collections.projects_collection.findOne(
                { id: project.id, deleted: null },
                { projection: { patientMapping: 1 } }
            );
        if (result && result.patientMapping) {
            return result.patientMapping;
        } else {
            return null;
        }
    }

    public async getProjectRoles(project: IProject) {
        return await this.db.collections.roles_collection.find({ studyId: project.studyId, projectId: project.id, deleted: null }).toArray();
    }

    public async createNewStudy(requester: IUserWithoutToken | undefined, studyName: string, description: string, type: studyType) {
        /* check if study already  exist (lowercase because S3 minio buckets cant be mixed case) */
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (requester.type !== enumUserTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        const existingStudies = await this.db.collections.studies_collection.aggregate<{ name: string }>(
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
            currentDataVersion: -1,
            dataVersions: [],
            description: description,
            ontologyTrees: [],
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {
                type: type
            }
        };
        await this.db.collections.studies_collection.insertOne(study);
        return {
            ...study,
            type: type
        };
    }

    public async validateAndGenerateFieldEntry(fieldEntry: CreateFieldInput, requester: IUserWithoutToken) {
        // duplicates with existing fields are checked by caller function
        const error: string[] = [];
        const complusoryField = [
            'fieldId',
            'fieldName',
            'dataType'
        ];

        // check missing field
        for (const key of complusoryField) {
            if (fieldEntry[key] === undefined && fieldEntry[key] === null) {
                error.push(`${key} should not be empty.`);
            }
        }
        // only english letters, numbers and _ are allowed in fieldIds
        if (!/^[a-zA-Z0-9_]*$/.test(fieldEntry.fieldId || '')) {
            error.push('FieldId should contain letters, numbers and _ only.');
        }
        // data types
        const dataTypes = ['int', 'dec', 'str', 'bool', 'date', 'file', 'json', 'cat'];
        if (!fieldEntry.dataType || !dataTypes.includes(fieldEntry.dataType)) {
            error.push(`Data type shouldn't be ${fieldEntry.dataType}: use 'int' for integer, 'dec' for decimal, 'str' for string, 'bool' for boolean, 'date' for datetime, 'file' for FILE, 'json' for json.`);
        }
        // check possiblevalues to be not-empty if datatype is categorical
        if (fieldEntry.dataType === enumV2DataType.CAT) {
            if (fieldEntry.possibleValues !== undefined && fieldEntry.possibleValues !== null) {
                if (fieldEntry.possibleValues.length === 0) {
                    error.push(`${fieldEntry.fieldId}-${fieldEntry.fieldName}: possible values can't be empty if data type is categorical.`);
                }
                for (let i = 0; i < fieldEntry.possibleValues.length; i++) {
                    fieldEntry.possibleValues[i]['id'] = uuid();
                }
            } else {
                error.push(`${fieldEntry.fieldId}-${fieldEntry.fieldName}: possible values can't be empty if data type is categorical.`);
            }
        }

        const newField = {
            fieldId: fieldEntry.fieldId,
            fieldName: fieldEntry.fieldName,
            tableName: null,
            dataType: fieldEntry.dataType,
            possibleValues: fieldEntry.dataType === enumV2DataType.CAT ? fieldEntry.possibleValues : null,
            unit: fieldEntry.unit,
            comments: fieldEntry.comments,
            metadata: {
                'uploader:org': requester.organisation,
                'uploader:user': requester.id,
                ...fieldEntry.metadata
            }
        };

        return { fieldEntry: newField, error: error };
    }

    public async createNewField(requester: IUserWithoutToken | undefined, studyId: string, fieldInput: CreateFieldInput[]) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        /* user can get study if he has readonly permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }
        // check study exists
        await this.findOneStudy_throwErrorIfNotExist(studyId);

        const response: IGenericResponse[] = [];
        let isError = false;
        const bulk = this.db.collections.field_dictionary_collection.initializeUnorderedBulkOp();
        // remove duplicates by fieldId
        const keysToCheck = ['fieldId'];
        const filteredFieldInput = fieldInput.filter(
            (s => o => (k => !s.has(k) && s.add(k))(keysToCheck.map(k => o[k]).join('|')))(new Set())
        );
        // check fieldId duplicate
        for (const oneFieldInput of filteredFieldInput) {
            isError = false;
            // check data valid
            if (!(await this.permissionCore.checkFieldPermission(roles, oneFieldInput, enumDataAtomicPermissions.WRITE))) {
                isError = true;
                response.push({ successful: false, code: errorCodes.NO_PERMISSION_ERROR, description: 'You do not have permissions to create this field.' });
                continue;
            }
            const { error: thisError } = await this.validateAndGenerateFieldEntry(oneFieldInput, requester);
            if (thisError.length !== 0) {
                response.push({ successful: false, code: errorCodes.CLIENT_MALFORMED_INPUT, description: `Field ${oneFieldInput.fieldId || 'fieldId not defined'}-${oneFieldInput.fieldName || 'fieldName not defined'}: ${JSON.stringify(thisError)}` });
                isError = true;
            } else {
                response.push({ successful: true, description: `Field ${oneFieldInput.fieldId}-${oneFieldInput.fieldName} is created successfully.` });
            }
            // // construct the rest of the fields
            if (!isError) {
                const newFieldEntry: IField = {
                    id: uuid(),
                    studyId: studyId,
                    fieldName: oneFieldInput.fieldName,
                    fieldId: oneFieldInput.fieldId,
                    dataType: (() => {
                        if (oneFieldInput.dataType === 'int') {
                            return enumDataTypes.INTEGER;
                        } else if (oneFieldInput.dataType === 'dec') {
                            return enumDataTypes.DECIMAL;
                        } else if (oneFieldInput.dataType === 'str') {
                            return enumDataTypes.STRING;
                        } else if (oneFieldInput.dataType === 'bool') {
                            return enumDataTypes.BOOLEAN;
                        } else if (oneFieldInput.dataType === 'date') {
                            return enumDataTypes.DATETIME;
                        } else if (oneFieldInput.dataType === 'file') {
                            return enumDataTypes.FILE;
                        } else if (oneFieldInput.dataType === 'json') {
                            return enumDataTypes.JSON;
                        } else if (oneFieldInput.dataType === 'cat') {
                            return enumDataTypes.CATEGORICAL;
                        } else {
                            return enumDataTypes.STRING;
                        }
                    })(),
                    properties: oneFieldInput.fieldId.startsWith('Device') ? [{
                        name: 'participantId',
                        required: true
                    }, {
                        name: 'deviceId',
                        required: true
                    }, {
                        name: 'startDate',
                        required: true
                    }, {
                        name: 'endDate',
                        required: true
                    }] : [{
                        name: 'm_subjectId',
                        required: true
                    }, {
                        name: 'm_visitId',
                        required: true
                    }],
                    categoricalOptions: oneFieldInput.dataType === 'cat' ? oneFieldInput.possibleValues : undefined,
                    unit: oneFieldInput.unit,
                    comments: oneFieldInput.comments,
                    dataVersion: null,
                    life: {
                        createdTime: Date.now(),
                        createdUser: requester.id,
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {
                        tableName: oneFieldInput.tableName
                    }
                };
                bulk.insert(newFieldEntry);
            }
        }
        if (bulk.batches.length > 0) {
            await bulk.execute();
        }
        return response;
    }

    public async editField(requester: IUserWithoutToken | undefined, studyId: string, fieldInput: EditFieldInput) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (requester.type !== enumUserTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        // check fieldId exist
        const searchField = await this.db.collections.field_dictionary_collection.findOne<IField>({ studyId: studyId, fieldId: fieldInput.fieldId, dateDeleted: null });
        if (!searchField) {
            throw new GraphQLError('Field does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        searchField.fieldId = fieldInput.fieldId;
        searchField.fieldName = fieldInput.fieldName;
        if (fieldInput.tableName) {
            searchField.metadata['tableName'] = fieldInput.tableName;
        }
        if (fieldInput.unit) {
            searchField.unit = fieldInput.unit;
        }
        if (fieldInput.possibleValues) {
            searchField.categoricalOptions = fieldInput.possibleValues;
        }
        if (fieldInput.tableName) {
            searchField.metadata['tableName'] = fieldInput.tableName;
        }
        if (fieldInput.comments) {
            searchField.comments = fieldInput.comments;
        }

        const { error } = await this.validateAndGenerateFieldEntry({ ...this.fieldTypeConverter([searchField])[0], dataType: fieldInput.dataType }, requester);
        if (error.length !== 0) {
            throw new GraphQLError(JSON.stringify(error), { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
        }
        // const newFieldEntry = { ...fieldEntry, id: searchField.id, dateAdded: searchField.dateAdded, deleted: searchField.dateDeleted, studyId: searchField.studyId };
        const newFieldEntry: IField = {
            id: searchField.id,
            studyId: searchField.studyId,
            fieldName: searchField.fieldName,
            fieldId: searchField.fieldId,
            dataType: searchField.dataType,
            categoricalOptions: searchField.categoricalOptions,
            unit: searchField.unit,
            comments: searchField.comments,
            dataVersion: null,
            life: {
                createdTime: searchField.life.createdTime,
                createdUser: searchField.life.createdUser,
                deletedTime: searchField.life.deletedTime,
                deletedUser: searchField.life.deletedUser
            },
            verifier: searchField.verifier,
            properties: searchField.properties,
            metadata: searchField.metadata
        };
        await this.db.collections.field_dictionary_collection.findOneAndUpdate({ studyId: studyId, fieldId: newFieldEntry.fieldId }, { $set: newFieldEntry });

        return newFieldEntry;
    }

    public async deleteField(requester: IUserWithoutToken | undefined, studyId: string, fieldId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        if (!(await this.permissionCore.checkFieldPermission(roles, { fieldId: fieldId }, enumDataAtomicPermissions.DELETE))) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        // check fieldId exist
        const searchField = await this.db.collections.field_dictionary_collection.find({ studyId: studyId, fieldId: fieldId, dateDeleted: null }).limit(1).sort({ dateAdded: -1 }).toArray();
        if (searchField.length === 0 || searchField[0].life.deletedTime !== null) {
            throw new GraphQLError('Field does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }

        const fieldEntry: IField = {
            id: uuid(),
            studyId: studyId,
            fieldName: searchField[0].fieldName,
            fieldId: searchField[0].fieldId,
            dataType: searchField[0].dataType,
            categoricalOptions: searchField[0].categoricalOptions,
            unit: searchField[0].unit,
            comments: searchField[0].comments,
            dataVersion: null,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: Date.now(),
                deletedUser: requester.id
            },
            verifier: searchField[0].verifier,
            properties: searchField[0].properties,
            metadata: searchField[0].metadata
        };
        await this.db.collections.field_dictionary_collection.insertOne(fieldEntry);
        return this.fieldTypeConverter([fieldEntry])[0];
    }

    public async editStudy(requester: IUserWithoutToken | undefined, studyId: string, description: string): Promise<IStudy> {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (requester.type !== enumUserTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        const res = await this.db.collections.studies_collection.findOneAndUpdate({ id: studyId }, { $set: { description: description } }, { returnDocument: 'after' });
        if (res) {
            return res;
        } else {
            throw new GraphQLError('Edit study failed');
        }
    }

    public async uploadDataInArray(requester: IUserWithoutToken | undefined, studyId: string, data: IDataClip[]) {
        // check study exists
        const study = await this.findOneStudy_throwErrorIfNotExist(studyId);

        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        /* user can get study if he has readonly permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        // find the fieldsList, including those that have not been versioned, same method as getStudyFields
        // get all dataVersions that are valid (before/equal the current version)
        const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        const fieldRecords = await this.db.collections.field_dictionary_collection.aggregate([{
            $sort: { 'life.createdTime': -1 }
        }, {
            $match: { $or: [{ dataVersion: null }, { dataVersion: { $in: availableDataVersions } }] }
        }, {
            $match: { studyId: studyId }
        }, {
            $group: {
                _id: '$fieldId',
                doc: { $first: '$$ROOT' }
            }
        }
        ]).toArray();
        // filter those that have been deleted
        const fieldsList = fieldRecords.map(el => el['doc']).filter(eh => eh.life.deletedTime === null);
        const response = (await this.uploadOneDataClip(requester, studyId, roles, fieldsList, data));

        return response;
    }

    public async deleteDataRecords(requester: IUserWithoutToken | undefined, studyId: string, subjectIds: string[], visitIds: string[], fieldIds: string[]) {
        // check study exists
        await this.findOneStudy_throwErrorIfNotExist(studyId);
        const response: IGenericResponse[] = [];
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        let validSubjects: string[];
        let validVisits: string[];
        let validFields;
        // filter
        if (subjectIds === undefined || subjectIds === null || subjectIds.length === 0) {
            validSubjects = (await this.db.collections.data_collection.distinct('properties.m_subjectId', { studyId: studyId }));
        } else {
            validSubjects = subjectIds;
        }
        if (visitIds === undefined || visitIds === null || visitIds.length === 0) {
            validVisits = (await this.db.collections.data_collection.distinct('properties.m_visitId', { studyId: studyId }));
        } else {
            validVisits = visitIds;
        }
        if (fieldIds === undefined || fieldIds === null || fieldIds.length === 0) {
            validFields = (await this.db.collections.field_dictionary_collection.distinct('fieldId', { studyId: studyId }));
        } else {
            validFields = fieldIds;
        }

        const bulk = this.db.collections.data_collection.initializeUnorderedBulkOp();
        for (const subjectId of validSubjects) {
            for (const visitId of validVisits) {
                for (const fieldId of validFields) {
                    const dataEntry: IData = {
                        studyId: studyId,
                        fieldId: fieldId,
                        value: null,
                        properties: {
                            m_subjectId: subjectId,
                            m_visitId: visitId
                        },
                        dataVersion: null,
                        life: {
                            createdTime: Date.now(),
                            createdUser: requester.id,
                            deletedTime: Date.now(),
                            deletedUser: requester.id
                        },
                        id: uuid(),
                        metadata: {}
                    };
                    if (!(await this.permissionCore.checkDataPermission(roles, dataEntry, enumDataAtomicPermissions.DELETE))) {
                        response.push({ successful: false, description: `SubjectId-${subjectId}:visitId-${visitId}:fieldId-${fieldId} does not have permission to delete.` });
                        continue;
                    }
                    bulk.insert(dataEntry);
                    response.push({ successful: true, description: `SubjectId-${subjectId}:visitId-${visitId}:fieldId-${fieldId} is deleted.` });
                }
            }
        }
        if (bulk.batches.length > 0) {
            await bulk.execute();
        }
        return response;
    }

    public async createNewDataVersion(requester: IUserWithoutToken | undefined, studyId: string, dataVersion: string, tag: string) {
        // check study exists
        await this.findOneStudy_throwErrorIfNotExist(studyId);

        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        /* check privileges */
        if (requester.type !== enumUserTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        // check dataVersion name valid
        if (!/^\d{1,3}(\.\d{1,2}){0,2}$/.test(dataVersion)) {
            throw new GraphQLError(errorCodes.CLIENT_MALFORMED_INPUT);
        }
        const newDataVersionId = uuid();

        // update data
        const resData = await this.db.collections.data_collection.updateMany({
            studyId: studyId,
            dataVersion: null
        }, {
            $set: {
                dataVersion: newDataVersionId
            }
        });
        // update field
        const resField = await this.db.collections.field_dictionary_collection.updateMany({
            studyId: studyId,
            dataVersion: null
        }, {
            $set: {
                dataVersion: newDataVersionId
            }
        });
        // update standardization
        const resStandardization = await this.db.collections.standardizations_collection.updateMany({
            studyId: studyId,
            dataVersion: null
        }, {
            $set: {
                dataVersion: newDataVersionId
            }
        });

        // update ontology trees
        const resOntologyTrees = await this.db.collections.studies_collection.updateOne({ 'id': studyId, 'deleted': null, 'ontologyTrees.dataVersion': null }, {
            $set: {
                'ontologyTrees.$.dataVersion': newDataVersionId
            }
        });

        if (resData.modifiedCount === 0 && resField.modifiedCount === 0 && resStandardization.modifiedCount === 0 && resOntologyTrees.modifiedCount === 0) {
            return null;
        }

        // insert a new version into study
        const newDataVersion: IStudyDataVersion = {
            id: newDataVersionId,
            version: dataVersion,
            tag: tag,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };
        await this.db.collections.studies_collection.updateOne({ id: studyId }, {
            $push: { dataVersions: newDataVersion },
            $inc: {
                currentDataVersion: 1
            }
        });

        if (newDataVersion === null) {
            throw new GraphQLError('No matched or modified records', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        return {
            ...newDataVersion,
            updateDate: newDataVersion.life.createdTime.toString(),
            contentId: uuid()
        };
    }

    public async uploadOneDataClip(requester: IUserWithoutToken, studyId: string, roles: IRole[], fieldList: Partial<IField>[], data: IDataClip[]): Promise<unknown> {
        const response: IGenericResponse[] = [];
        let bulk = this.db.collections.data_collection.initializeUnorderedBulkOp();
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
            const dataEntry: IData = {
                id: uuid(),
                studyId: studyId,
                fieldId: dataClip.fieldId,
                dataVersion: null,
                value: null,
                properties: {
                    m_subjectId: dataClip.subjectId,
                    m_visitId: dataClip.visitId
                },
                life: {
                    createdTime: Date.now(),
                    createdUser: requester.id,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            };

            if (!(await this.permissionCore.checkDataPermission(roles, dataEntry, enumDataAtomicPermissions.WRITE))) {
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
                    case enumDataTypes.DECIMAL: {// decimal
                        if (typeof (dataClip.value) !== 'string') {
                            error = `Field ${dataClip.fieldId}: Cannot parse as decimal.`;
                            break;
                        }
                        if (!/^-?\d+(\.\d+)?$/.test(dataClip.value)) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as decimal.`;
                            break;
                        }
                        parsedValue = parseFloat(dataClip.value);
                        break;
                    }
                    case enumDataTypes.INTEGER: {// integer
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
                    case enumDataTypes.BOOLEAN: {// boolean
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
                    case enumDataTypes.STRING: {
                        if (typeof (dataClip.value) !== 'string') {
                            error = `Field ${dataClip.fieldId}: Cannot parse as string.`;
                            break;
                        }
                        parsedValue = dataClip.value.toString();
                        break;
                    }
                    // 01/02/2021 00:00:00
                    case enumDataTypes.DATETIME: {
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
                    case enumDataTypes.JSON: {
                        parsedValue = dataClip.value;
                        break;
                    }
                    case enumDataTypes.FILE: {
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
                    case enumDataTypes.CATEGORICAL: {
                        if (!fieldInDb.categoricalOptions) {
                            error = `Field ${dataClip.fieldId}: Cannot parse as categorical, possible values not defined.`;
                            break;
                        }
                        if (dataClip.value && !fieldInDb.categoricalOptions.map((el) => el.code).includes(dataClip.value?.toString())) {
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
            bulk.insert({
                id: uuid(),
                studyId: studyId,
                fieldId: dataClip.fieldId,
                dataVersion: null,
                value: parsedValue,
                properties: {
                    m_subjectId: dataClip.subjectId,
                    m_visitId: dataClip.visitId
                },
                life: {
                    createdTime: Date.now(),
                    createdUser: requester.id,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            });

            if (bulk.batches.length > 999) {
                await bulk.execute();
                bulk = this.db.collections.data_collection.initializeUnorderedBulkOp();
            }
        }
        bulk.batches.length !== 0 && await bulk.execute();
        return response;
    }

    // This file uploading function will not check any metadate of the file
    public async uploadFile(studyId: string, data: IDataClip, uploader: IUserWithoutToken, args: { fileLength?: number, fileHash?: string }): Promise<IFile | { code: errorCodes, description: string }> {
        if (!data.file || typeof (data.file) === 'string') {
            return { code: errorCodes.CLIENT_MALFORMED_INPUT, description: 'Invalid File Stream' };
        }
        const study = await this.db.collections.studies_collection.findOne({ id: studyId });
        if (!study) {
            return { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, description: 'Study does not exist.' };
        }
        const organisations = await this.db.collections.organisations_collection.find({ 'life.deletedTime': null }).toArray();
        const sitesIDMarkers: Record<string, string> = organisations.reduce((acc, curr) => {
            if (curr.metadata['siteIDMarker']) {
                acc[String(curr.metadata['siteIDMarker'])] = curr.shortname ?? curr.name;
            }
            return acc;
        }, {} as Record<string, string>);
        // check file metadata
        let parsedDescription: Record<string, unknown>;
        let startDate: number;
        let endDate: number;
        let deviceId: string;
        let participantId: string;
        if (data.metadata) {
            try {
                parsedDescription = data.metadata;
                if (!parsedDescription['startDate'] || !parsedDescription['endDate'] || !parsedDescription['deviceId'] || !parsedDescription['participantId']) {
                    return { code: errorCodes.CLIENT_MALFORMED_INPUT, description: 'File description is invalid' };
                }
                startDate = parseInt(parsedDescription['startDate'].toString());
                endDate = parseInt(parsedDescription['endDate'].toString());
                participantId = parsedDescription['participantId'].toString();
                deviceId = parsedDescription['deviceId'].toString();
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
        const dataEntry = await this.db.collections.data_collection.findOne({ 'studyId': studyId, 'properties.m_visitId': data.visitId, 'properties.m_subjectId': data.subjectId, 'dataVersion': null, 'fieldId': data.fieldId });
        const oldFileId = dataEntry ? dataEntry.value : null;
        return new Promise<IFile>((resolve, reject) => {
            (async () => {
                try {
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


                    await this.objStore.uploadFile(stream, studyId, fileUri);

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
                    const fileParts: string[] = file.filename.split('.');
                    const fileExtension = fileParts.length === 1 ? enumFileTypes.UNKNOWN : (fileParts[fileParts.length - 1].trim().toUpperCase() in enumFileTypes ? fileParts[fileParts.length - 1].trim().toUpperCase() : enumFileTypes.UNKNOWN);

                    const fileEntry: Partial<IFile> = {
                        id: uuid(),
                        studyId: studyId,
                        userId: null,
                        fileName: file.filename,
                        fileSize: readBytes,
                        description: JSON.stringify({}),
                        properties: {
                            participantId: participantId,
                            deviceId: deviceId,
                            startDate: startDate,
                            endDate: endDate,
                            site: sitesIDMarkers[participantId.substr(0, 1).toUpperCase()] ?? 'Unknown'
                        },
                        uri: fileUri,
                        hash: hashString,
                        fileType: fileExtension in enumFileTypes ? enumFileTypes[fileExtension] : enumFileTypes.UNKNOWN,
                        fileCategory: enumFileCategories.STUDY_DATA_FILE,
                        sharedUsers: []
                    };
                    const insertResult = await this.db.collections.files_collection.insertOne(fileEntry as IFile);
                    if (insertResult.acknowledged) {
                        // delete old file if existing
                        oldFileId && await this.db.collections.files_collection.findOneAndUpdate({ studyId: studyId, id: oldFileId }, { $set: { deleted: Date.now().valueOf() } });
                        resolve(fileEntry as IFile);
                    } else {
                        throw new GraphQLError(errorCodes.DATABASE_ERROR);
                    }
                }
                catch (error) {
                    reject({ code: errorCodes.CLIENT_MALFORMED_INPUT, description: 'Missing file metadata.', error });
                    return;
                }
            })().catch(() => { return; });
        });
    }

    public async createOntologyTree(requester: IUserWithoutToken | undefined, studyId: string, ontologyTree: Pick<IOntologyTree, 'name' | 'routes'>) {
        /* check study exists */
        const study = await this.findOneStudy_throwErrorIfNotExist(studyId);

        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* user can get study if he has readonly permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        // in case of old documents whose ontologyTrees are invalid
        if (study.ontologyTrees === undefined || study.ontologyTrees === null) {
            await this.db.collections.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, {
                $set: {
                    ontologyTrees: []
                }
            });
        }
        const ontologyTreeWithId: Partial<IOntologyTree> = { ...ontologyTree };
        ontologyTreeWithId.id = uuid();
        ontologyTreeWithId.routes = ontologyTreeWithId.routes || [];
        ontologyTreeWithId.routes.forEach(el => {
            el.id = uuid();
            el.visitRange = el.visitRange || [];
        });
        await this.db.collections.studies_collection.findOneAndUpdate({
            id: studyId, deleted: null, ontologyTrees: {
                $not: {
                    $elemMatch: {
                        name: ontologyTree.name,
                        dataVersion: null
                    }
                }
            }
        }, {
            $addToSet: {
                ontologyTrees: ontologyTreeWithId
            }
        });
        await this.db.collections.studies_collection.findOneAndUpdate({ id: studyId, deleted: null, ontologyTrees: { $elemMatch: { name: ontologyTreeWithId.name, dataVersion: null } } }, {
            $set: {
                'ontologyTrees.$.routes': ontologyTreeWithId.routes,
                'ontologyTrees.$.dataVersion': null,
                'ontologyTrees.$.deleted': null
            }
        });
        return ontologyTreeWithId as IOntologyTree;
    }

    public async deleteOntologyTree(requester: IUserWithoutToken | undefined, studyId: string, treeName: string) {
        /* check study exists */
        await this.findOneStudy_throwErrorIfNotExist(studyId);

        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* user can get study if he has readonly permission */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        const resultAdd = await this.db.collections.studies_collection.findOneAndUpdate({
            id: studyId, deleted: null, ontologyTrees: {
                $not: {
                    $elemMatch: {
                        name: treeName,
                        dataVersion: null
                    }
                }
            }
        }, {
            $addToSet: {
                ontologyTrees: {
                    id: uuid(),
                    name: treeName,
                    dataVersion: null,
                    deleted: Date.now().valueOf()
                }
            }
        });
        const resultUpdate = await this.db.collections.studies_collection.findOneAndUpdate({
            id: studyId, deleted: null, ontologyTrees: { $elemMatch: { name: treeName, dataVersion: null } }
        }, {
            $set: {
                'ontologyTrees.$.deleted': Date.now().valueOf(),
                'ontologyTrees.$.routes': undefined
            }
        });
        if (resultAdd || resultUpdate) {
            return makeGenericReponse(treeName);
        } else {
            throw new GraphQLError(errorCodes.DATABASE_ERROR);
        }
    }

    public async createProjectForStudy(requester: IUserWithoutToken | undefined, studyId: string, projectName: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }


        /* making sure that the study exists first */
        await this.findOneStudy_throwErrorIfNotExist(studyId);

        /* create project */
        const project: IProject = {
            id: uuid(),
            studyId,
            createdBy: requester.id,
            name: projectName,
            patientMapping: {},
            lastModified: new Date().valueOf(),
            deleted: null,
            metadata: {}
        };

        const getListOfPatientsResult = await this.db.collections.data_collection.aggregate([
            { $match: { studyId: studyId } },
            { $group: { _id: null, array: { $addToSet: '$m_subjectId' } } },
            { $project: { array: 1 } }
        ]).toArray();

        if (getListOfPatientsResult === null || getListOfPatientsResult === undefined) {
            throw new GraphQLError('Cannot get list of patients', { extensions: { code: errorCodes.DATABASE_ERROR } });
        }

        if (getListOfPatientsResult[0] !== undefined) {
            project.patientMapping = this.createPatientIdMapping(getListOfPatientsResult[0]['array']);
        }

        await this.db.collections.projects_collection.insertOne(project);
        return project;
    }

    public async deleteStudy(requester: IUserWithoutToken | undefined, studyId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (requester.type !== enumUserTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }
        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new GraphQLError('Study does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        /* PRECONDITION: CHECKED THAT STUDY INDEED EXISTS */
        const session = this.db.client.startSession();
        session.startTransaction();

        const timestamp = new Date().valueOf();

        try {
            /* delete the study */
            await this.db.collections.studies_collection.findOneAndUpdate({ 'id': studyId, 'life.deletedTime': null }, { $set: { 'life.deletedUser': requester.id, 'life.deletedTime': timestamp } });

            /* delete all projects related to the study */
            await this.db.collections.projects_collection.updateMany({ studyId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } });

            /* delete all roles related to the study */
            await this.db.collections.roles_collection.updateMany({ studyId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': timestamp, 'life.deletedUser': requester.id } });

            /* delete all files belong to the study*/
            await this.db.collections.files_collection.updateMany({ studyId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': timestamp } });

            await session.commitTransaction();
            session.endSession().catch(() => { return; });

        } catch (error) {
            // If an error occurred, abort the whole transaction and
            // undo any changes that might have happened
            await session.abortTransaction();
            session.endSession().catch(() => { return; });
            throw error; // Rethrow so calling function sees error
        }
        return makeGenericReponse(studyId);
    }

    public async deleteProject(requester: IUserWithoutToken | undefined, projectId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const project = await this.findOneProject_throwErrorIfNotExist(projectId);

        /* check privileges */
        const roles = await this.permissionCore.getRolesOfUser(requester, project.studyId);
        if (!roles.length) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }


        /* delete project */
        const timestamp = new Date().valueOf();

        /* delete all projects related to the study */
        await this.db.collections.projects_collection.findOneAndUpdate({ id: projectId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } }, { returnDocument: 'after' });

        /* delete all roles related to the study */
        await this.db.collections.roles_collection.updateMany({ projectId, 'life.deletedTime': null }, { $set: { 'life.deletedTime': timestamp, 'life.deletedUser': requester.id } });
        return makeGenericReponse(projectId);
    }

    public async setDataversionAsCurrent(requester: IUserWithoutToken | undefined, studyId: string, dataVersionId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        const roles = await this.permissionCore.getRolesOfUser(requester, studyId);
        if (requester.type !== enumUserTypes.ADMIN && roles.every(el => el.studyRole !== enumStudyRoles.STUDY_MANAGER)) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }


        const study = await this.findOneStudy_throwErrorIfNotExist(studyId);

        /* check whether the dataversion exists */
        const selectedataVersionFiltered = study.dataVersions.filter((el) => el.id === dataVersionId);
        if (selectedataVersionFiltered.length !== 1) {
            throw new GraphQLError(errorCodes.CLIENT_MALFORMED_INPUT);
        }

        /* update the currentversion field in database */
        const versionIdsList = study.dataVersions.map((el) => el.id);
        const result = await this.db.collections.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, {
            $set: { currentDataVersion: versionIdsList.indexOf(dataVersionId) }
        }, {
            returnDocument: 'after'
        });

        if (result) {
            return result;
        } else {
            throw new GraphQLError(errorCodes.DATABASE_ERROR);
        }
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

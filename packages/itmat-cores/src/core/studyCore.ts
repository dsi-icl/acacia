import { GraphQLError } from 'graphql';
import { IFile, IProject, IStudy, studyType, IStudyDataVersion, IDataEntry, IDataClip, IRole, IFieldEntry, deviceTypes, IOrganisation, IUserWithoutToken, IPermissionManagementOptions, atomicOperation, userTypes, IOntologyTree, ISubjectDataRecordSummary, IQueryString, IGroupedData, enumValueType, IValueDescription } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { errorCodes } from '../utils/errors';
import { ICombinedPermissions, PermissionCore, translateCohort } from './permissionCore';
import { validate } from '@ideafast/idgen';
import type { Filter, MatchKeysAndValues } from 'mongodb';
import { FileUpload } from 'graphql-upload-minimal';
import crypto from 'crypto';
import { fileSizeLimit } from '../utils/definition';
import { IGenericResponse, makeGenericReponse } from '../utils/responses';
import { buildPipeline, dataStandardization, translateMetadata } from '../utils/query';
import { DBType } from '../database/database';
import { ObjectStore } from '@itmat-broker/itmat-commons';

export interface CreateFieldInput {
    fieldId: string;
    fieldName: string
    tableName: string
    dataType: enumValueType
    possibleValues?: IValueDescription[]
    unit?: string
    comments?: string
    metadata: Record<string, unknown>
}

export interface EditFieldInput {
    fieldId: string;
    fieldName: string;
    tableName?: string;
    dataType: enumValueType;
    possibleValues?: IValueDescription[]
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
        const hasPermission = await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.own,
            atomicOperation.READ,
            requester,
            studyId
        );
        if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        const study = await this.db.collections.studies_collection.findOne({ id: studyId, deleted: null });
        if (study === null || study === undefined) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        return study;
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
        const hasProjectLevelPermission = await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.own,
            atomicOperation.READ,
            requester,
            project.studyId,
            projectId
        );

        const hasStudyLevelPermission = await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.own,
            atomicOperation.READ,
            requester,
            project.studyId
        );
        if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        return project;
    }

    public async getStudyFields(requester: IUserWithoutToken | undefined, studyId: string, projectId?: string, versionId?: string | null) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* user can get study if he has readonly permission */
        const hasStudyLevelPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            studyId
        );
        const hasProjectLevelPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            studyId,
            projectId
        );
        if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }
        const study = await this.findOneStudy_throwErrorIfNotExist(studyId);
        const aggregatedPermissions = this.permissionCore.combineMultiplePermissions([hasStudyLevelPermission, hasProjectLevelPermission]);

        // the processes of requiring versioned data and unversioned data are different
        // check the metadata:role:**** for versioned data directly
        const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        // check the regular expressions for unversioned data
        if (requester.type === userTypes.ADMIN) {
            if (versionId === null) {
                availableDataVersions.push(null);
            }
            const fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
                $match: { studyId: studyId, dataVersion: { $in: availableDataVersions } }
            }, {
                $sort: { dateAdded: -1 }
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
            return fieldRecords.filter(el => el.dateDeleted === null);
        }
        // unversioned data could not be returned by metadata filters
        if (versionId === null && aggregatedPermissions.hasVersioned) {
            availableDataVersions.push(null);
            const fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
                $match: { studyId: studyId, dataVersion: { $in: availableDataVersions } }
            }, {
                $sort: { dateAdded: -1 }
            }, {
                $match: {
                    fieldId: { $in: aggregatedPermissions.raw.fieldIds.map((el: string) => new RegExp(el)) }
                }
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
            return fieldRecords.filter(el => el.dateDeleted === null);
        } else {
            // metadata filter
            const subqueries: Filter<{ [key: string]: string | number | boolean }>[] = [];
            aggregatedPermissions.matchObj.forEach((subMetadata) => {
                subqueries.push(translateMetadata(subMetadata));
            });
            const metadataFilter = { $or: subqueries };
            const fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
                $match: { studyId: studyId, dataVersion: { $in: availableDataVersions } }
            }, {
                $sort: { dateAdded: -1 }
            }, { $match: metadataFilter }, {
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
            }, {
                $set: { metadata: null }
            }]).toArray();
            return fieldRecords.filter(el => el.dateDeleted === null);
        }
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
        const hasProjectLevelPermission = await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.ontologyTrees,
            atomicOperation.READ,
            requester,
            studyId,
            projectId
        );

        const hasStudyLevelPermission = await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.ontologyTrees,
            atomicOperation.READ,
            requester,
            studyId
        );
        if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        // if versionId is null, we will only return trees whose data version is null
        // this is a different behavior from getting fields or data
        if (study.ontologyTrees === undefined) {
            return [];
        } else {
            const trees: IOntologyTree[] = study.ontologyTrees;
            if (hasStudyLevelPermission && versionId === null) {
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

    public async checkDataComplete(requester: IUserWithoutToken | undefined, studyId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        /* user can get study if he has readonly permission */
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            studyId
        );
        if (!hasPermission) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }
        // we only check data that hasnt been pushed to a new data version
        const data: IDataEntry[] = await this.db.collections.data_collection.find({
            m_studyId: studyId,
            m_versionId: null,
            m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
            m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
            m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) }
        }).toArray();
        const fieldMapping = (await this.db.collections.field_dictionary_collection.aggregate([{
            $match: { studyId: studyId }
        }, {
            $match: { fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) } }
        }, {
            $sort: { dateAdded: -1 }
        }, {
            $group: {
                _id: '$fieldId',
                doc: { $last: '$$ROOT' }
            }
        }
        ]).toArray()).map(el => el['doc']).filter(eh => eh.dateDeleted === null).reduce((acc, curr) => {
            acc[curr.fieldId] = curr;
            return acc;
        }, {});
        const summary: ISubjectDataRecordSummary[] = [];
        // we will not check data whose fields are not defined, because data that the associated fields are undefined will not be returned while querying data
        for (const record of data) {
            let error: string | null = null;
            if (fieldMapping[record.m_fieldId] !== undefined && fieldMapping[record.m_fieldId] !== null) {
                switch (fieldMapping[record.m_fieldId].dataType) {
                    case 'dec': {// decimal
                        if (typeof record.value === 'number') {
                            if (!/^\d+(.\d+)?$/.test(record.value.toString())) {
                                error = `Field ${record.m_fieldId}: Cannot parse as decimal.`;
                                break;
                            }
                        } else {
                            error = `Field ${record.m_fieldId}: Cannot parse as decimal.`;
                            break;
                        }
                        break;
                    }
                    case 'int': {// integer
                        if (typeof record.value === 'number') {
                            if (!/^-?\d+$/.test(record.value.toString())) {
                                error = `Field ${record.m_fieldId}: Cannot parse as integer.`;
                                break;
                            }
                        } else {
                            error = `Field ${record.m_fieldId}: Cannot parse as integer.`;
                            break;
                        }
                        break;
                    }
                    case 'bool': {// boolean
                        if (typeof record.value !== 'boolean') {
                            error = `Field ${record.m_fieldId}: Cannot parse as boolean.`;
                            break;
                        }
                        break;
                    }
                    case 'str': {
                        break;
                    }
                    // 01/02/2021 00:00:00
                    case 'date': {
                        if (typeof record.value === 'string') {
                            const matcher = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?/;
                            if (!record.value.match(matcher)) {
                                error = `Field ${record.m_fieldId}: Cannot parse as data. Value for date type must be in ISO format.`;
                                break;
                            }
                        } else {
                            error = `Field ${record.m_fieldId}: Cannot parse as data. Value for date type must be in ISO format.`;
                            break;
                        }
                        break;
                    }
                    case 'json': {
                        break;
                    }
                    case 'file': {
                        if (typeof record.value === 'string') {
                            const file = await this.db.collections.files_collection.findOne({ id: record.value });
                            if (!file) {
                                error = `Field ${record.m_fieldId}: Cannot parse as file or file does not exist.`;
                                break;
                            }
                        } else {
                            error = `Field ${record.m_fieldId}: Cannot parse as file or file does not exist.`;
                            break;
                        }
                        break;
                    }
                    case 'cat': {
                        if (typeof record.value === 'string') {
                            if (!fieldMapping[record.m_fieldId].possibleValues.map((el) => el.code).includes(record.value.toString())) {
                                error = `Field ${record.m_fieldId}: Cannot parse as categorical, value not in value list.`;
                                break;
                            }
                        } else {
                            error = `Field ${record.m_fieldId}: Cannot parse as categorical, value not in value list.`;
                            break;
                        }
                        break;
                    }
                    default: {
                        error = `Field ${record.m_fieldId}: Invalid data Type.`;
                        break;
                    }
                }
            }
            error && summary.push({
                subjectId: record.m_subjectId,
                visitId: record.m_visitId,
                fieldId: record.m_fieldId,
                error: error
            });
        }

        return summary;
    }

    public async getDataRecords(requester: IUserWithoutToken | undefined, queryString: IQueryString, studyId: string, versionId: string | null | undefined, projectId?: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }

        /* user can get study if he has readonly permission */
        const hasStudyLevelPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            studyId
        );
        const hasProjectLevelPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            studyId,
            projectId
        );
        if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

        const study = await this.findOneStudy_throwErrorIfNotExist(studyId);
        const aggregatedPermissions = this.permissionCore.combineMultiplePermissions([hasStudyLevelPermission, hasProjectLevelPermission]);

        let availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        let fieldRecords: IFieldEntry[] = [];
        let result;
        let metadataFilter;
        // we obtain the data by different requests
        // admin used will not filtered by metadata filters
        if (requester.type === userTypes.ADMIN) {
            if (versionId !== undefined) {
                if (versionId === null) {
                    availableDataVersions.push(null);
                } else if (versionId === '-1') {
                    availableDataVersions = availableDataVersions.length !== 0 ? [availableDataVersions[availableDataVersions.length - 1]] : [];
                } else {
                    availableDataVersions = [versionId];
                }
            }

            fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
                $match: { studyId: studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions } }
            }, {
                $sort: { dateAdded: -1 }
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
            const pipeline = buildPipeline(queryString, studyId, availableDataVersions, fieldRecords, undefined, true, versionId === null);
            result = await this.db.collections.data_collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
        } else {
            const subqueries: Filter<{ [key: string]: string | number | boolean }>[] = [];
            aggregatedPermissions.matchObj.forEach((subMetadata) => {
                subqueries.push(translateMetadata(subMetadata));
            });
            metadataFilter = { $or: subqueries };
            // unversioned data: metadatafilter for versioned data and all unversioned tags
            if (versionId === null && aggregatedPermissions.hasVersioned) {
                availableDataVersions.push(null);
                fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
                    $match: { studyId: studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions } }
                }, {
                    $sort: { dateAdded: -1 }
                }, {
                    $match: {
                        $or: [
                            metadataFilter,
                            { m_versionId: null }
                        ]
                    }
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
                if (queryString.data_requested && queryString.data_requested?.length > 0) {
                    fieldRecords = fieldRecords.filter(el => (queryString.data_requested || []).includes(el.fieldId));
                }
            } else if (versionId === undefined || versionId === '-1') {
                if (versionId === '-1') {
                    availableDataVersions = availableDataVersions.length !== 0 ? [availableDataVersions[availableDataVersions.length - 1]] : [];
                }
                fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
                    $match: { studyId: studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions } }
                }, {
                    $sort: { dateAdded: -1 }
                }, {
                    $match: {
                        $or: [
                            metadataFilter
                        ]
                    }
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
                if (queryString.data_requested && queryString.data_requested?.length > 0) {
                    fieldRecords = fieldRecords.filter(el => (queryString.data_requested || []).includes(el.fieldId));
                }
            } else if (versionId !== undefined) {
                availableDataVersions = [versionId];
                fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
                    $match: { studyId: studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions } }
                }, {
                    $sort: { dateAdded: -1 }
                }, {
                    $match: {
                        $or: [
                            metadataFilter
                        ]
                    }
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
                if (queryString.data_requested && queryString.data_requested?.length > 0) {
                    fieldRecords = fieldRecords.filter(el => (queryString.data_requested || []).includes(el.fieldId));
                }
            }

            // TODO: placeholder for metadata filter
            // if (queryString.metadata) {
            //     metadataFilter = { $and: queryString.metadata.map((el) => translateMetadata(el)) };
            // }
            const pipeline = buildPipeline(queryString, studyId, availableDataVersions, fieldRecords, metadataFilter, false, versionId === null && aggregatedPermissions.hasVersioned);
            result = await this.db.collections.data_collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
        }
        // post processing the data
        // 2. update to the latest data; start from first record
        const groupedResult: IGroupedData = {};
        for (let i = 0; i < result.length; i++) {
            const { m_subjectId, m_visitId, m_fieldId, value } = result[i];
            if (!groupedResult[m_subjectId]) {
                groupedResult[m_subjectId] = {};
            }
            if (!groupedResult[m_subjectId][m_visitId]) {
                groupedResult[m_subjectId][m_visitId] = {};
            }
            groupedResult[m_subjectId][m_visitId][m_fieldId] = value;
        }

        // 2. adjust format: 1) original(exists) 2) standardized - $name 3) grouped
        // when standardized data, versionId should not be specified
        const standardizations = versionId === null ? null : await this.db.collections.standardizations_collection.find({ studyId: studyId, type: queryString['format'].split('-')[1], delete: null, dataVersion: { $in: availableDataVersions } }).toArray();
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
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            study.id
        );

        if (!hasPermission) {
            return [];
        }
        const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        const fileFieldIds: string[] = (await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
            $match: { studyId: study.id, dateDeleted: null, dataVersion: { $in: availableDataVersions }, dataType: enumValueType.FILE }
        }, { $match: { fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) } } }, {
            $sort: { dateAdded: -1 }
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
        }]).toArray()).map(el => el.fieldId);
        let adds: string[] = [];
        let removes: string[] = [];
        // versioned data
        if (requester.type === userTypes.ADMIN) {
            const fileRecords = await this.db.collections.data_collection.aggregate<IDataEntry>([{
                $match: { m_studyId: study.id, m_fieldId: { $in: fileFieldIds } }
            }]).toArray();
            adds = fileRecords.map(el => el.metadata?.add || []).flat();
            removes = fileRecords.map(el => el.metadata?.remove || []).flat();
        } else {
            const subqueries: Filter<{ [key: string]: string | number | boolean }>[] = [];
            hasPermission.matchObj.forEach((subMetadata) => {
                subqueries.push(translateMetadata(subMetadata));
            });
            const metadataFilter = { $or: subqueries };
            const versionedFileRecors = await this.db.collections.data_collection.aggregate<IDataEntry>([{
                $match: { m_studyId: study.id, m_versionId: { $in: availableDataVersions }, m_fieldId: { $in: fileFieldIds } }
            }, {
                $match: metadataFilter
            }]).toArray();

            const filters: Filter<IDataEntry>[] = [];
            for (const role of hasPermission.roleraw) {
                if (!(role.hasVersioned)) {
                    continue;
                }
                filters.push({
                    m_subjectId: { $in: role.subjectIds.map((el: string) => new RegExp(el)) },
                    m_visitId: { $in: role.visitIds.map((el: string) => new RegExp(el)) },
                    m_fieldId: { $in: role.fieldIds.map((el: string) => new RegExp(el)) },
                    m_versionId: null
                });
            }
            let unversionedFileRecords: IDataEntry[] = [];
            if (filters.length !== 0) {
                unversionedFileRecords = await this.db.collections.data_collection.aggregate<IDataEntry>([{
                    $match: { m_studyId: study.id, m_versionId: null, m_fieldId: { $in: fileFieldIds } }
                }, {
                    $match: { $or: filters }
                }]).toArray();
            }
            adds = versionedFileRecors.map(el => el.metadata?.add || []).flat();
            removes = versionedFileRecors.map(el => el.metadata?.remove || []).flat();
            adds = adds.concat(unversionedFileRecords.map(el => el.metadata?.add || []).flat());
            removes = removes.concat(unversionedFileRecords.map(el => el.metadata?.remove || []).flat());
        }
        return await this.db.collections.files_collection.find({ studyId: study.id, deleted: null, $or: [{ id: { $in: adds, $nin: removes } }, { description: JSON.stringify({}) }] }).sort({ uploadTime: -1 }).toArray();
    }

    public async getStudySubjects(requester: IUserWithoutToken | undefined, study: IStudy) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            study.id
        );
        if (!hasPermission) {
            return [[], []];
        }
        const availableDataVersions: Array<string> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        const versionedSubjects = (await this.db.collections.data_collection.distinct('m_subjectId', {
            m_studyId: study.id,
            m_versionId: availableDataVersions[availableDataVersions.length - 1],
            m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
            m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
            m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) },
            value: { $ne: null }
        })).sort() || [];
        const unVersionedSubjects = hasPermission.hasVersioned ? (await this.db.collections.data_collection.distinct('m_subjectId', {
            m_studyId: study.id,
            m_versionId: null,
            m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
            m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
            m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) },
            value: { $ne: null }
        })).sort() || [] : [];
        return [versionedSubjects, unVersionedSubjects];
    }

    public async getStudyVisits(requester: IUserWithoutToken | undefined, study: IStudy) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            study.id
        );
        if (!hasPermission) {
            return [[], []];
        }
        const availableDataVersions: Array<string> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        const versionedVisits = (await this.db.collections.data_collection.distinct('m_visitId', {
            m_studyId: study.id,
            m_versionId: availableDataVersions[availableDataVersions.length - 1],
            m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
            m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
            m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) },
            value: { $ne: null }
        })).sort((a, b) => parseFloat(a) - parseFloat(b));
        const unVersionedVisits = hasPermission.hasVersioned ? (await this.db.collections.data_collection.distinct('m_visitId', {
            m_studyId: study.id,
            m_versionId: null,
            m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
            m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
            m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) },
            value: { $ne: null }
        })).sort((a, b) => parseFloat(a) - parseFloat(b)) : [];
        return [versionedVisits, unVersionedVisits];
    }

    public async getStudyNumOfRecords(requester: IUserWithoutToken | undefined, study: IStudy) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            study.id
        );
        if (!hasPermission) {
            return [0, 0];
        }
        const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        const numberOfVersioned: number = (await this.db.collections.data_collection.aggregate([{
            $match: { m_studyId: study.id, m_versionId: availableDataVersions[availableDataVersions.length - 1], value: { $ne: null } }
        }, {
            $match: {
                m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
                m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
                m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) }
            }
        }, {
            $count: 'count'
        }]).toArray())[0]?.['count'] || 0;
        const numberOfUnVersioned: number = hasPermission.hasVersioned ? (await this.db.collections.data_collection.aggregate([{
            $match: { m_studyId: study.id, m_versionId: null, value: { $ne: null } }
        }, {
            $match: {
                m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
                m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
                m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) }
            }
        }, {
            $count: 'count'
        }]).toArray())[0]?.['count'] || 0 : 0;
        return [numberOfVersioned, numberOfUnVersioned];
    }

    public async getStudyCurrentDataVersion(study: IStudy) {
        return study.currentDataVersion === -1 ? null : study.currentDataVersion;
    }

    public async getProjectFields(requester: IUserWithoutToken | undefined, project: Omit<IProject, 'patientMapping'>) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const hasProjectLevelPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            project.studyId,
            project.id
        );
        if (!hasProjectLevelPermission) { return []; }
        // get all dataVersions that are valid (before the current version)
        const study = await this.findOneStudy_throwErrorIfNotExist(project.studyId);

        // the processes of requiring versioned data and unversioned data are different
        // check the metadata:role:**** for versioned data directly
        // check the regular expressions for unversioned data
        const availableDataVersions: string[] = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        const availableTrees: IOntologyTree[] = [];
        const trees: IOntologyTree[] = study.ontologyTrees || [];
        for (let i = trees.length - 1; i >= 0; i--) {
            if (availableDataVersions.includes(trees[i].dataVersion || '')
                && availableTrees.filter(el => el.name === trees[i].name).length === 0) {
                availableTrees.push(trees[i]);
            } else {
                continue;
            }
        }
        if (availableTrees.length === 0) {
            return [];
        }
        const ontologyTreeFieldIds: string[] = (availableTrees[0].routes || []).map(el => el.field[0].replace('$', ''));
        let fieldRecords: IFieldEntry[] = [];
        if (requester.type === userTypes.ADMIN) {
            fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
                $match: { studyId: project.studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions }, fieldId: { $in: ontologyTreeFieldIds } }
            }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $last: '$$ROOT' }
                }
            }, {
                $replaceRoot: {
                    newRoot: '$doc'
                }
            }, {
                $sort: { fieldId: 1 }
            }, {
                $set: { metadata: null }
            }]).toArray();
        } else {
            // metadata filter
            const subqueries: Filter<{ [key: string]: string | number | boolean }>[] = [];
            hasProjectLevelPermission.matchObj.forEach((subMetadata) => {
                subqueries.push(translateMetadata(subMetadata));
            });
            const metadataFilter = { $or: subqueries };
            fieldRecords = await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
                $match: { studyId: project.studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions }, fieldId: { $in: ontologyTreeFieldIds } }
            }, { $match: metadataFilter }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $last: '$$ROOT' }
                }
            }, {
                $replaceRoot: {
                    newRoot: '$doc'
                }
            }, {
                $sort: { fieldId: 1 }
            }, {
                $set: { metadata: null }
            }]).toArray();
        }
        return fieldRecords;
    }

    public async getProjectJobs(project: Omit<IProject, 'patientMapping'>) {
        return await this.db.collections.jobs_collection.find({ studyId: project.studyId, projectId: project.id }).toArray();
    }

    public async getProjectFiles(requester: IUserWithoutToken | undefined, project: Omit<IProject, 'patientMapping'>) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            project.studyId,
            project.id
        );
        if (!hasPermission) {
            return [];
        }
        const study = await this.findOneStudy_throwErrorIfNotExist(project.studyId);
        const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        const availableTrees: IOntologyTree[] = [];
        const trees: IOntologyTree[] = study.ontologyTrees || [];
        for (let i = trees.length - 1; i >= 0; i--) {
            if (availableDataVersions.includes(trees[i].dataVersion || '')
                && availableTrees.filter(el => el.name === trees[i].name).length === 0) {
                availableTrees.push(trees[i]);
            } else {
                continue;
            }
        }
        if (availableTrees.length === 0) {
            return [];
        }
        const ontologyTreeFieldIds: string[] = (availableTrees[0].routes || []).map(el => el.field[0].replace('$', ''));
        const fileFieldIds: string[] = (await this.db.collections.field_dictionary_collection.aggregate<IFieldEntry>([{
            $match: { studyId: study.id, dateDeleted: null, dataVersion: { $in: availableDataVersions }, dataType: enumValueType.FILE }
        }, { $match: { $and: [{ fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) } }, { fieldId: { $in: ontologyTreeFieldIds } }] } }, {
            $group: {
                _id: '$fieldId',
                doc: { $last: '$$ROOT' }
            }
        }, {
            $replaceRoot: {
                newRoot: '$doc'
            }
        }, {
            $sort: { fieldId: 1 }
        }]).toArray()).map(el => el.fieldId);
        let add: string[] = [];
        let remove: string[] = [];
        if (Object.keys(hasPermission.matchObj).length === 0) {
            (await this.db.collections.data_collection.aggregate<IDataEntry>([{
                $match: { m_studyId: study.id, m_versionId: { $in: availableDataVersions }, m_fieldId: { $in: fileFieldIds } }
            }]).toArray()).forEach(element => {
                add = add.concat(element.metadata?.add || []);
                remove = remove.concat(element.metadata?.remove || []);
            });
        } else {
            const subqueries: Filter<{ [key: string]: string | number | boolean }>[] = [];
            hasPermission.matchObj.forEach((subMetadata) => {
                subqueries.push(translateMetadata(subMetadata));
            });
            const metadataFilter = { $or: subqueries };
            (await this.db.collections.data_collection.aggregate<IDataEntry>([{
                $match: { m_studyId: study.id, m_versionId: { $in: availableDataVersions }, m_fieldId: { $in: fileFieldIds } }
            }, {
                $match: metadataFilter
            }]).toArray()).forEach(element => {
                add = add.concat(element.metadata?.add || []);
                remove = remove.concat(element.metadata?.remove || []);
            });
        }
        return await this.db.collections.files_collection.find({ $and: [{ id: { $in: add } }, { id: { $nin: remove } }] }).toArray();
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
        const hasStudyLevelPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            project.studyId
        );
        const hasProjectLevelPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,
            requester,
            project.studyId,
            project.id
        );
        if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }
        // get all dataVersions that are valid (before the current version)
        const aggregatedPermissions = this.permissionCore.combineMultiplePermissions([hasStudyLevelPermission, hasProjectLevelPermission]);

        let metadataFilter;

        const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        // ontology trees
        const availableTrees: IOntologyTree[] = [];
        const trees: IOntologyTree[] = study.ontologyTrees || [];
        for (let i = trees.length - 1; i >= 0; i--) {
            if (availableDataVersions.includes(trees[i].dataVersion || '')
                && availableTrees.filter(el => el.name === trees[i].name).length === 0) {
                availableTrees.push(trees[i]);
            } else {
                continue;
            }
        }
        // const ontologyTreeFieldIds = (availableTrees[0]?.routes || []).map(el => el.field[0].replace('$', ''));

        let fieldRecords;
        if (requester.type === userTypes.ADMIN) {
            fieldRecords = await this.db.collections.field_dictionary_collection.aggregate([{
                $match: { studyId: project.studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions } }
            }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $last: '$$ROOT' }
                }
            }, {
                $replaceRoot: {
                    newRoot: '$doc'
                }
            }]).toArray();
        } else {
            const subqueries: Filter<{ [key: string]: string | number | boolean }>[] = [];
            aggregatedPermissions.matchObj.forEach((subMetadata) => {
                subqueries.push(translateMetadata(subMetadata));
            });
            metadataFilter = { $or: subqueries };
            fieldRecords = await this.db.collections.field_dictionary_collection.aggregate([{
                $match: { studyId: project.studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions } }
            }, { $match: metadataFilter }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $last: '$$ROOT' }
                }
            }, {
                $replaceRoot: {
                    newRoot: '$doc'
                }
            }]).toArray();
        }
        // fieldRecords = fieldRecords.filter(el => ontologyTreeFieldIds.includes(el.fieldId));
        const emptyQueryString: IQueryString = {
            cohort: [[]],
            new_fields: []
        };
        const pipeline = buildPipeline(emptyQueryString, project.studyId, [availableDataVersions[availableDataVersions.length - 1]], fieldRecords as IFieldEntry[], metadataFilter, requester.type === userTypes.ADMIN, false);
        const result = await this.db.collections.data_collection.aggregate<{ m_subjectId: string, m_visitId: string, m_fieldId: string, value: unknown }>(pipeline, { allowDiskUse: true }).toArray();
        summary['subjects'] = Array.from(new Set(result.map((el) => el.m_subjectId))).sort();
        summary['visits'] = Array.from(new Set(result.map((el) => el.m_visitId))).sort((a, b) => parseFloat(a) - parseFloat(b)).sort();
        summary['standardizationTypes'] = (await this.db.collections.standardizations_collection.distinct('type', { studyId: study.id, deleted: null })).sort();
        return summary;
    }

    public async getProjectPatientMapping(requester: IUserWithoutToken | undefined, project: IProject) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (!(await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.READ,  // patientMapping is not visible to project users; only to study users.
            requester,
            project.studyId
        ))) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
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

    public async createNewStudy(requester: IUserWithoutToken | undefined, studyName: string, description: string, type: studyType): Promise<IStudy> {
        /* check if study already  exist (lowercase because S3 minio buckets cant be mixed case) */
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (requester.type !== userTypes.ADMIN) {
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
            createdBy: requester.id,
            currentDataVersion: -1,
            lastModified: new Date().valueOf(),
            dataVersions: [],
            deleted: null,
            description: description,
            type: type,
            ontologyTrees: [],
            metadata: {}
        };
        await this.db.collections.studies_collection.insertOne(study);
        return study;
    }

    public async validateAndGenerateFieldEntry(fieldEntry: Partial<IFieldEntry>, requester: IUserWithoutToken) {
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
        if (!fieldEntry.dataType || !Object.values(enumValueType).includes(fieldEntry.dataType)) {
            error.push(`Data type shouldn't be ${fieldEntry.dataType}: use 'int' for integer, 'dec' for decimal, 'str' for string, 'bool' for boolean, 'date' for datetime, 'file' for FILE, 'json' for json.`);
        }
        // check possiblevalues to be not-empty if datatype is categorical
        if (fieldEntry.dataType === enumValueType.CATEGORICAL) {
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
            tableName: fieldEntry.tableName,
            dataType: fieldEntry.dataType,
            possibleValues: fieldEntry.dataType === enumValueType.CATEGORICAL ? fieldEntry.possibleValues : null,
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
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.WRITE,
            requester,
            studyId
        );
        if (!hasPermission) {
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
            if (!(this.permissionCore.checkDataEntryValid(hasPermission.raw, oneFieldInput.fieldId))) {
                isError = true;
                response.push({ successful: false, code: errorCodes.NO_PERMISSION_ERROR, description: 'You do not have permissions to create this field.' });
                continue;
            }
            const { fieldEntry, error: thisError } = await this.validateAndGenerateFieldEntry(oneFieldInput, requester);
            if (thisError.length !== 0) {
                response.push({ successful: false, code: errorCodes.CLIENT_MALFORMED_INPUT, description: `Field ${oneFieldInput.fieldId || 'fieldId not defined'}-${oneFieldInput.fieldName || 'fieldName not defined'}: ${JSON.stringify(thisError)}` });
                isError = true;
            } else {
                response.push({ successful: true, description: `Field ${oneFieldInput.fieldId}-${oneFieldInput.fieldName} is created successfully.` });
            }
            // // construct the rest of the fields
            if (!isError) {
                const newFieldEntry: IFieldEntry = {
                    ...fieldEntry,
                    fieldId: oneFieldInput.fieldId,
                    fieldName: oneFieldInput.fieldName,
                    dataType: oneFieldInput.dataType,
                    id: uuid(),
                    studyId: studyId,
                    dataVersion: null,
                    dateAdded: Date.now(),
                    dateDeleted: null,
                    metadata: {
                        uploader: requester.id
                    }
                };
                bulk.find({
                    fieldId: fieldEntry.fieldId,
                    studyId: studyId,
                    dataVersion: null
                }).upsert().updateOne({ $set: newFieldEntry });
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
        if (requester.type !== userTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        // check fieldId exist
        const searchField = await this.db.collections.field_dictionary_collection.findOne<IFieldEntry>({ studyId: studyId, fieldId: fieldInput.fieldId, dateDeleted: null });
        if (!searchField) {
            throw new GraphQLError('Field does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        searchField.fieldId = fieldInput.fieldId;
        searchField.fieldName = fieldInput.fieldName;
        searchField.dataType = fieldInput.dataType;
        if (fieldInput.tableName) {
            searchField.tableName = fieldInput.tableName;
        }
        if (fieldInput.unit) {
            searchField.unit = fieldInput.unit;
        }
        if (fieldInput.possibleValues) {
            searchField.possibleValues = fieldInput.possibleValues;
        }
        if (fieldInput.tableName) {
            searchField.tableName = fieldInput.tableName;
        }
        if (fieldInput.comments) {
            searchField.comments = fieldInput.comments;
        }

        const { fieldEntry, error } = await this.validateAndGenerateFieldEntry(searchField, requester);
        if (error.length !== 0) {
            throw new GraphQLError(JSON.stringify(error), { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
        }
        const newFieldEntry = { ...fieldEntry, id: searchField.id, dateAdded: searchField.dateAdded, deleted: searchField.dateDeleted, studyId: searchField.studyId };
        await this.db.collections.field_dictionary_collection.findOneAndUpdate({ studyId: studyId, fieldId: newFieldEntry.fieldId }, { $set: newFieldEntry });

        return newFieldEntry;
    }

    public async deleteField(requester: IUserWithoutToken | undefined, studyId: string, fieldId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.WRITE,
            requester,
            studyId
        );
        if (!hasPermission) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        if (!(await this.permissionCore.checkDataEntryValid(hasPermission.raw, fieldId))) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        // check fieldId exist
        const searchField = await this.db.collections.field_dictionary_collection.find({ studyId: studyId, fieldId: fieldId, dateDeleted: null }).limit(1).sort({ dateAdded: -1 }).toArray();
        if (searchField.length === 0 || searchField[0].dateDeleted !== null) {
            throw new GraphQLError('Field does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }

        const fieldEntry = {
            id: uuid(),
            studyId: studyId,
            fieldId: searchField[0].fieldId,
            fieldName: searchField[0].fieldName,
            tableName: searchField[0].tableName,
            dataType: searchField[0].dataType,
            possibleValues: searchField[0].possibleValues,
            unit: searchField[0].unit,
            comments: searchField[0].comments,
            dataVersion: null,
            dateAdded: (new Date()).valueOf(),
            dateDeleted: (new Date()).valueOf()
        };
        await this.db.collections.field_dictionary_collection.insertOne(fieldEntry);
        return searchField[0];
    }

    public async editStudy(requester: IUserWithoutToken | undefined, studyId: string, description: string): Promise<IStudy> {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (requester.type !== userTypes.ADMIN) {
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
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.WRITE,
            requester,
            studyId
        );
        if (!hasPermission) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        // find the fieldsList, including those that have not been versioned, same method as getStudyFields
        // get all dataVersions that are valid (before/equal the current version)
        const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        const fieldRecords = await this.db.collections.field_dictionary_collection.aggregate([{
            $sort: { dateAdded: -1 }
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
        const fieldsList = fieldRecords.map(el => el['doc']).filter(eh => eh.dateDeleted === null);
        const response = (await this.uploadOneDataClip(studyId, hasPermission.raw, fieldsList, data, requester));

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
        const hasPermission = await this.permissionCore.userHasTheNeccessaryDataPermission(
            atomicOperation.WRITE,
            requester,
            studyId
        );
        if (!hasPermission) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        let validSubjects: string[];
        let validVisits: string[];
        let validFields;
        // filter
        if (subjectIds === undefined || subjectIds === null || subjectIds.length === 0) {
            validSubjects = (await this.db.collections.data_collection.distinct('m_subjectId', { m_studyId: studyId }));
        } else {
            validSubjects = subjectIds;
        }
        if (visitIds === undefined || visitIds === null || visitIds.length === 0) {
            validVisits = (await this.db.collections.data_collection.distinct('m_visitId', { m_studyId: studyId }));
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
                    if (!(await this.permissionCore.checkDataEntryValid(hasPermission.raw, fieldId, subjectId, visitId))) {
                        continue;
                    }
                    bulk.find({ m_studyId: studyId, m_subjectId: subjectId, m_visitId: visitId, m_fieldId: fieldId, m_versionId: null }).upsert().updateOne({
                        $set: {
                            m_studyId: studyId,
                            m_subjectId: subjectId,
                            m_visitId: visitId,
                            m_versionId: null,
                            m_fieldId: fieldId,
                            value: null,
                            uploadedAt: (new Date()).valueOf(),
                            id: uuid()
                        }
                    });
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
        if (requester.type !== userTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        // check dataVersion name valid
        if (!/^\d{1,3}(\.\d{1,2}){0,2}$/.test(dataVersion)) {
            throw new GraphQLError(errorCodes.CLIENT_MALFORMED_INPUT);
        }
        const newDataVersionId = uuid();
        const newContentId = uuid();

        // update data
        const resData = await this.db.collections.data_collection.updateMany({
            m_studyId: studyId,
            m_versionId: null
        }, {
            $set: {
                m_versionId: newDataVersionId
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
            contentId: newContentId, // same content = same id - used in reverting data, version control
            version: dataVersion,
            tag: tag,
            updateDate: (new Date().valueOf()).toString()
        };
        await this.db.collections.studies_collection.updateOne({ id: studyId }, {
            $push: { dataVersions: newDataVersion },
            $inc: {
                currentDataVersion: 1
            }
        });

        // update permissions based on roles
        const roles = await this.db.collections.roles_collection.find<IRole>({ studyId: studyId, deleted: null }).toArray();
        for (const role of roles) {
            const filters: ICombinedPermissions = {
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
                    validSubjects = (await this.db.collections.data_collection.aggregate<{
                        m_subjectId: string, m_visitId: string, m_fieldId: string, value: string | number | boolean | { [key: string]: unknown }
                    }>([{
                        $match: { m_fieldId: { $in: role.permissions.data.filters.map(el => el.field) } }
                    },
                    {
                        $sort: { uploadedAt: -1 }
                    }, {
                        $group: {
                            _id: { m_subjectId: '$m_subjectId', m_visitId: '$m_visitId', m_fieldId: '$m_fieldId' },
                            doc: { $first: '$$ROOT' }
                        }
                    }, {
                        $project: {
                            m_subjectId: '$doc.m_subjectId',
                            m_visitId: '$doc.m_visitId',
                            m_fieldId: '$doc.m_fieldId',
                            value: '$doc.value',
                            _id: 0
                        }
                    }, {
                        $match: { $and: subqueries }
                    }], { allowDiskUse: true }).toArray()).map(el => el.m_subjectId);
                }
            }
            if (validSubjects === null) {
                validSubjects = [/^.*$/];
            }
            const tag = `metadata.${'role:'.concat(role.id)}`;
            await this.db.collections.data_collection.updateMany({
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
            await this.db.collections.data_collection.updateMany({
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
            await this.db.collections.field_dictionary_collection.updateMany({
                studyId: studyId,
                dataVersion: newDataVersionId,
                fieldId: { $in: filters.fieldIds.map((el: string) => new RegExp(el)) }
            }, {
                $set: { [tag]: true }
            });
            await this.db.collections.field_dictionary_collection.updateMany({
                studyId: studyId,
                dataVersion: newDataVersionId,
                fieldId: { $nin: filters.fieldIds.map((el: string) => new RegExp(el)) }
            }, {
                $set: { [tag]: false }
            });
        }
        if (newDataVersion === null) {
            throw new GraphQLError('No matched or modified records', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        return newDataVersion;
    }

    public async uploadOneDataClip(studyId: string, permissions, fieldList: Partial<IFieldEntry>[], data: IDataClip[], requester: IUserWithoutToken): Promise<unknown> {
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
            if (!(await this.permissionCore.checkDataEntryValid(permissions, dataClip.fieldId, dataClip.subjectId, dataClip.visitId))) {
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
                        if (dataClip.value && !fieldInDb.possibleValues.map((el) => el.code).includes(dataClip.value?.toString())) {
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
                const existing = await this.db.collections.data_collection.findOne<IDataEntry>(obj);
                if (!existing) {
                    await this.db.collections.data_collection.insertOne({
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
                        add: (existing?.metadata?.add || []).concat(parsedValue),
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
        const sitesIDMarkers = (await this.db.collections.organisations_collection.find<IOrganisation>({ deleted: null }).toArray()).reduce<{ [key: string]: string | null }>((acc, curr) => {
            if (curr.metadata?.siteIDMarker) {
                acc[curr.metadata.siteIDMarker] = curr.shortname;
            }
            return acc;
        }, {});
        // check file metadata
        if (data.metadata) {
            let parsedDescription: Record<string, unknown>;
            let startDate: number;
            let endDate: number;
            let deviceId: string;
            let participantId: string;
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
        const dataEntry = await this.db.collections.data_collection.findOne({ m_studyId: studyId, m_visitId: data.visitId, m_subjectId: data.subjectId, m_versionId: null, m_fieldId: data.fieldId });
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
                        metadata: (data.metadata as Record<string, unknown>)
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

                    fileEntry.fileSize = readBytes.toString();
                    fileEntry.uri = fileUri;
                    fileEntry.hash = hashString;
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
        const hasPermission = await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.ontologyTrees,
            atomicOperation.WRITE,
            requester,
            studyId
        );
        if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

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
        const hasPermission = await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.ontologyTrees,
            atomicOperation.WRITE,
            requester,
            studyId
        );
        if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

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
        if (!(await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.own,
            atomicOperation.WRITE,
            requester,
            studyId
        ))) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

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
            { $match: { m_studyId: studyId } },
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
        if (requester.type !== userTypes.ADMIN) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }
        const study = await this.db.collections.studies_collection.findOne({ id: studyId, deleted: null });
        if (!study) {
            throw new GraphQLError('Study does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
        }
        /* PRECONDITION: CHECKED THAT STUDY INDEED EXISTS */
        const session = this.db.client.startSession();
        session.startTransaction();

        const timestamp = new Date().valueOf();

        try {
            /* delete the study */
            await this.db.collections.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } });

            /* delete all projects related to the study */
            await this.db.collections.projects_collection.updateMany({ studyId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } });

            /* delete all roles related to the study */
            await this.permissionCore.removeRoleFromStudyOrProject({ studyId });

            /* delete all files belong to the study*/
            await this.db.collections.files_collection.updateMany({ studyId, deleted: null }, { $set: { deleted: timestamp } });

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
        if (!(await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.own,
            atomicOperation.WRITE,
            requester,
            project.studyId
        ))) {
            throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
        }

        /* delete project */
        const timestamp = new Date().valueOf();

        /* delete all projects related to the study */
        await this.db.collections.projects_collection.findOneAndUpdate({ id: projectId, deleted: null }, { $set: { lastModified: timestamp, deleted: timestamp } }, { returnDocument: 'after' });

        /* delete all roles related to the study */
        await this.permissionCore.removeRoleFromStudyOrProject({ projectId });
        return makeGenericReponse(projectId);
    }

    public async setDataversionAsCurrent(requester: IUserWithoutToken | undefined, studyId: string, dataVersionId: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        /* check privileges */
        if (!(await this.permissionCore.userHasTheNeccessaryManagementPermission(
            IPermissionManagementOptions.own,
            atomicOperation.WRITE,
            requester,
            studyId
        ))) {
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

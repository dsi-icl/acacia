import { GraphQLError } from 'graphql';
import {
    IProject,
    IStudy,
    IStudyDataVersion,
    IFieldEntry,
    IUser,
    IFile,
    IJobEntry,
    studyType,
    IDataClip,
    ISubjectDataRecordSummary,
    IRole,
    IOntologyTree,
    userTypes,
    atomicOperation,
    IPermissionManagementOptions,
    IDataEntry,
    enumValueType
} from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { permissionCore } from '../core/permissionCore';
import { validateAndGenerateFieldEntry } from '../core/fieldCore';
import { studyCore } from '../core/studyCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
import { buildPipeline, translateMetadata } from '../../utils/query';
import { dataStandardization } from '../../utils/query';

export const studyResolvers = {
    Query: {
        getStudy: async (__unused__parent: Record<string, unknown>, args: Record<string, string>, context: any): Promise<IStudy | null> => {
            const requester: IUser = context.req.user;
            const studyId: string = args.studyId;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.own,
                atomicOperation.READ,
                requester,
                studyId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            const study = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null })!;
            if (study === null || study === undefined) {
                throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            return study;
        },
        getProject: async (__unused__parent: Record<string, unknown>, args: any, context: any): Promise<Omit<IProject, 'patientMapping'> | null> => {
            const requester: IUser = context.req.user;
            const projectId: string = args.projectId;

            /* get project */ // defer patientMapping since it's costly and not available to all users
            const project = await db.collections!.projects_collection.findOne({ id: projectId, deleted: null }, { projection: { patientMapping: 0 } })!;
            if (!project)
                throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);

            /* check if user has permission */
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.own,
                atomicOperation.READ,
                requester,
                project.studyId,
                projectId
            );

            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.own,
                atomicOperation.READ,
                requester,
                project.studyId
            );
            if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            return project;
        },
        getStudyFields: async (__unused__parent: Record<string, unknown>, { studyId, projectId, versionId }: { studyId: string, projectId?: string, versionId?: string | null }, context: any): Promise<IFieldEntry[]> => {
            const requester: IUser = context.req.user;
            /* user can get study if he has readonly permission */
            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                studyId
            );
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                studyId,
                projectId
            );
            if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            const aggregatedPermissions: any = permissionCore.combineMultiplePermissions([hasStudyLevelPermission, hasProjectLevelPermission]);

            // the processes of requiring versioned data and unversioned data are different
            // check the metadata:role:**** for versioned data directly
            const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            // check the regular expressions for unversioned data
            if (requester.type === userTypes.ADMIN) {
                if (versionId === null) {
                    availableDataVersions.push(null);
                }
                const fieldRecords: any[] = await db.collections!.field_dictionary_collection.aggregate([{
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
                return fieldRecords;
            }
            // unversioned data could not be returned by metadata filters
            if (versionId === null && aggregatedPermissions.hasVersioned) {
                availableDataVersions.push(null);
                const fieldRecords: any[] = await db.collections!.field_dictionary_collection.aggregate([{
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
                return fieldRecords;
            } else {
                // metadata filter
                const subqueries: any = [];
                aggregatedPermissions.matchObj.forEach((subMetadata: any) => {
                    subqueries.push(translateMetadata(subMetadata));
                });
                const metadataFilter = { $or: subqueries };
                const fieldRecords: any[] = await db.collections!.field_dictionary_collection.aggregate([{
                    $match: { studyId: studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions } }
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
                return fieldRecords;
            }
        },
        getOntologyTree: async (__unused__parent: Record<string, unknown>, { studyId, projectId, treeName, versionId }: { studyId: string, projectId?: string, treeName?: string, versionId?: string }, context: any): Promise<IOntologyTree[]> => {
            /* get studyId by parameter or project */
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            if (projectId) {
                await studyCore.findOneProject_throwErrorIfNotExist(projectId);
            }

            const requester: IUser = context.req.user;

            // we dont filters fields of an ontology tree by fieldIds
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.ontologyTrees,
                atomicOperation.READ,
                requester,
                studyId,
                projectId
            );

            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
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
        },
        checkDataComplete: async (__unused__parent: Record<string, unknown>, { studyId }: { studyId: string }, context: any): Promise<any> => {
            const requester: IUser = context.req.user;
            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }
            // we only check data that hasnt been pushed to a new data version
            const data: IDataEntry[] = await db.collections!.data_collection.find({
                m_studyId: studyId,
                m_versionId: null,
                m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
                m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
                m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) }
            }).toArray();
            const fieldMapping = (await db.collections!.field_dictionary_collection.aggregate([{
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
            ]).toArray()).map(el => el.doc).filter(eh => eh.dateDeleted === null).reduce((acc, curr) => {
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
                            if (!/^\d+(.\d+)?$/.test(record.value)) {
                                error = `Field ${record.m_fieldId}: Cannot parse as decimal.`;
                                break;
                            }
                            break;
                        }
                        case 'int': {// integer
                            if (!/^-?\d+$/.test(record.value)) {
                                error = `Field ${record.m_fieldId}: Cannot parse as integer.`;
                                break;
                            }
                            break;
                        }
                        case 'bool': {// boolean
                            if (record.value.toLowerCase() !== 'true' && record.value.toLowerCase() !== 'false') {
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
                            const matcher = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?/;
                            if (!record.value.match(matcher)) {
                                error = `Field ${record.m_fieldId}: Cannot parse as data. Value for date type must be in ISO format.`;
                                break;
                            }
                            break;
                        }
                        case 'json': {
                            break;
                        }
                        case 'file': {
                            const file = await db.collections!.files_collection.findOne({ id: record.value });
                            if (!file) {
                                error = `Field ${record.m_fieldId}: Cannot parse as file or file does not exist.`;
                                break;
                            }
                            break;
                        }
                        case 'cat': {
                            if (!fieldMapping[record.m_fieldId].possibleValues.map((el: any) => el.code).includes(record.value.toString())) {
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
        },
        getDataRecords: async (__unused__parent: Record<string, unknown>, { studyId, queryString, versionId, projectId }: { queryString: any, studyId: string, versionId: string, projectId?: string }, context: any): Promise<any> => {
            const requester: IUser = context.req.user;
            /* user can get study if he has readonly permission */
            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                studyId
            );
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                studyId,
                projectId
            );
            if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            const aggregatedPermissions: any = permissionCore.combineMultiplePermissions([hasStudyLevelPermission, hasProjectLevelPermission]);

            let availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            let fieldRecords: any[];
            let result: any;
            let metadataFilter: any = undefined;

            // we obtain the data by different requests
            if (requester.type === userTypes.ADMIN) {
                if (versionId === null) {
                    availableDataVersions.push(null);
                }
                fieldRecords = await db.collections!.field_dictionary_collection.aggregate([{
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
                if (versionId === '-1') {
                    availableDataVersions = availableDataVersions.length !== 0 ? [availableDataVersions[availableDataVersions.length - 1]] : [];
                }
                const pipeline = buildPipeline(queryString, studyId, availableDataVersions, fieldRecords, undefined, true);
                result = await db.collections!.data_collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
            } else {
                if (versionId === null && aggregatedPermissions.hasVersioned) {
                    availableDataVersions.push(null);
                }
                // metadata filter
                const subqueries: any = [];
                aggregatedPermissions.matchObj.forEach((subMetadata: any) => {
                    subqueries.push(translateMetadata(subMetadata));
                });
                metadataFilter = { $or: subqueries };
                // if versionId is null; we will not filter by the ontologytrees
                if (versionId && versionId !== null) {
                    // metadata filter
                    const subqueries: any = [];
                    aggregatedPermissions.matchObj.forEach((subMetadata: any) => {
                        subqueries.push(translateMetadata(subMetadata));
                    });
                    metadataFilter = { $or: subqueries };
                    fieldRecords = await db.collections!.field_dictionary_collection.aggregate([{
                        $match: { studyId: studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions } }
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
                    }]).toArray();
                } else {
                    fieldRecords = await db.collections!.field_dictionary_collection.aggregate([{
                        $match: { studyId: studyId, dateDeleted: null, dataVersion: { $in: availableDataVersions } }
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
                    }]).toArray();
                }
                if (queryString.metadata) {
                    metadataFilter = { $and: queryString.metadata.map((el: any) => translateMetadata(el)) };
                }
                if (versionId === '-1') {
                    availableDataVersions = availableDataVersions.length !== 0 ? [availableDataVersions[availableDataVersions.length - 1]] : [];
                }
                const pipeline = buildPipeline(queryString, studyId, availableDataVersions, fieldRecords, metadataFilter, false);
                result = await db.collections!.data_collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
            }
            // post processing the data
            // 2. update to the latest data; start from first record
            const groupedResult: any = {};
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
            const standardizations = versionId === null ? null : await db.collections!.standardizations_collection.find({ studyId: studyId, type: queryString['format'].split('-')[1], delete: null, dataVersion: { $in: availableDataVersions } }).toArray();
            const formattedData = dataStandardization(study, fieldRecords,
                groupedResult, queryString, standardizations);
            return { data: formattedData };
        }
    },
    Study: {
        projects: async (study: IStudy): Promise<Array<IProject>> => {
            return await db.collections!.projects_collection.find({ studyId: study.id, deleted: null }).toArray();
        },
        jobs: async (study: IStudy): Promise<Array<IJobEntry<any>>> => {
            return await db.collections!.jobs_collection.find({ studyId: study.id }).toArray();
        },
        roles: async (study: IStudy): Promise<Array<IRole>> => {
            return await db.collections!.roles_collection.find({ studyId: study.id, projectId: undefined, deleted: null }).toArray();
        },
        files: async (study: IStudy, __unused__args: never, context: any): Promise<Array<IFile>> => {
            const requester: IUser = context.req.user;
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                study.id
            );

            if (!hasPermission) {
                return [];
            }

            const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            const fileFieldIds: string[] = (await db.collections!.field_dictionary_collection.aggregate([{
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
            let adds = [];
            let removes = [];

            // versioned data
            if (requester.type === userTypes.ADMIN) {
                const fileRecords = await db.collections!.data_collection.aggregate([{
                    $match: { m_studyId: study.id, m_fieldId: { $in: fileFieldIds } }
                }]).toArray();
                adds = fileRecords.map(el => el.metadata?.add || []).flat();
                removes = fileRecords.map(el => el.metadata?.remove || []).flat();
            } else {
                const subqueries: any = [];
                hasPermission.matchObj.forEach((subMetadata: any) => {
                    subqueries.push(translateMetadata(subMetadata));
                });
                const metadataFilter = { $or: subqueries };
                const versionedFileRecors = await db.collections!.data_collection.aggregate([{
                    $match: { m_studyId: study.id, m_versionId: { $in: availableDataVersions }, m_fieldId: { $in: fileFieldIds } }
                }, {
                    $match: metadataFilter
                }]).toArray();

                const filters = [];
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
                let unversionedFileRecords: any[] = [];
                if (filters.length !== 0) {
                    unversionedFileRecords = await db.collections!.data_collection.aggregate([{
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
            return await db.collections!.files_collection.find({ studyId: study.id, deleted: null, $or: [{ id: { $in: adds, $nin: removes } }, { description: JSON.stringify({}) }] }).sort({ uploadTime: -1 }).toArray();
        },
        subjects: async (study: IStudy, __unused__args: never, context: any): Promise<Array<Array<string>>> => {
            const requester: IUser = context.req.user;
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                study.id
            );
            if (!hasPermission) {
                return [[], []];
            }
            const availableDataVersions: Array<string> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            const versionedSubjects = (await db.collections!.data_collection.distinct('m_subjectId', {
                m_studyId: study.id,
                m_versionId: { $in: availableDataVersions },
                m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
                m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
                m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) },
                value: { $ne: null }
            })).sort() || [];
            const unVersionedSubjects = hasPermission.hasVersioned ? (await db.collections!.data_collection.distinct('m_subjectId', {
                m_studyId: study.id,
                m_versionId: { $in: [null] },
                m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
                m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
                m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) },
                value: { $ne: null }
            })).sort() || [] : [];
            return [versionedSubjects, unVersionedSubjects];
        },
        visits: async (study: IStudy, __unused__args: never, context: any): Promise<Array<Array<string>>> => {
            const requester: IUser = context.req.user;
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                study.id
            );
            if (!hasPermission) {
                return [[], []];
            }
            const availableDataVersions: Array<string> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            const versionedVisits = (await db.collections!.data_collection.distinct('m_visitId', {
                m_studyId: study.id,
                m_versionId: { $in: availableDataVersions },
                m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
                m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
                m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) },
                value: { $ne: null }
            })).sort((a, b) => parseFloat(a) - parseFloat(b));
            const unVersionedVisits = hasPermission.hasVersioned ? (await db.collections!.data_collection.distinct('m_visitId', {
                m_studyId: study.id,
                m_versionId: { $in: [null] },
                m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
                m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
                m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) },
                value: { $ne: null }
            })).sort((a, b) => parseFloat(a) - parseFloat(b)) : [];
            return [versionedVisits, unVersionedVisits];
        },
        numOfRecords: async (study: IStudy, __unused__args: never, context: any): Promise<number[]> => {
            const requester: IUser = context.req.user;
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                study.id
            );
            if (!hasPermission) {
                return [0, 0];
            }
            const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            const numberOfVersioned: number = (await db.collections!.data_collection.aggregate([{
                $match: { m_studyId: study.id, m_versionId: { $in: availableDataVersions }, value: { $ne: null } }
            }, {
                $match: {
                    m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
                    m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
                    m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) }
                }
            }, {
                $count: 'count'
            }]).toArray())[0]?.count || 0;
            const numberOfUnVersioned: number = hasPermission.hasVersioned ? (await db.collections!.data_collection.aggregate([{
                $match: { m_studyId: study.id, m_versionId: { $in: [null] }, value: { $ne: null } }
            }, {
                $match: {
                    m_subjectId: { $in: hasPermission.raw.subjectIds.map((el: string) => new RegExp(el)) },
                    m_visitId: { $in: hasPermission.raw.visitIds.map((el: string) => new RegExp(el)) },
                    m_fieldId: { $in: hasPermission.raw.fieldIds.map((el: string) => new RegExp(el)) }
                }
            }, {
                $count: 'count'
            }]).toArray())[0]?.count || 0 : 0;
            return [numberOfVersioned, numberOfUnVersioned];
        },
        currentDataVersion: async (study: IStudy): Promise<null | number> => {
            return study.currentDataVersion === -1 ? null : study.currentDataVersion;
        }
    },
    Project: {
        fields: async (project: Omit<IProject, 'patientMapping'>, __unused__args: never, context: any): Promise<Array<Partial<IFieldEntry>>> => {
            const requester: IUser = context.req.user;
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                project.studyId,
                project.id
            );
            if (!hasProjectLevelPermission) { return []; }
            // get all dataVersions that are valid (before the current version)
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(project.studyId);

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
            let fieldRecords: any[] = [];
            if (requester.type === userTypes.ADMIN) {
                fieldRecords = await db.collections!.field_dictionary_collection.aggregate([{
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
                const subqueries: any = [];
                hasProjectLevelPermission.matchObj.forEach((subMetadata: any) => {
                    subqueries.push(translateMetadata(subMetadata));
                });
                const metadataFilter = { $or: subqueries };
                fieldRecords = await db.collections!.field_dictionary_collection.aggregate([{
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
        },
        jobs: async (project: Omit<IProject, 'patientMapping'>): Promise<Array<IJobEntry<any>>> => {
            return await db.collections!.jobs_collection.find({ studyId: project.studyId, projectId: project.id }).toArray();
        },
        files: async (project: Omit<IProject, 'patientMapping'>, __unused__args: never, context: any): Promise<Array<IFile>> => {
            const requester: IUser = context.req.user;
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                project.studyId,
                project.id
            );
            if (!hasPermission) {
                return [];
            }
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(project.studyId);
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
            const fileFieldIds: string[] = (await db.collections!.field_dictionary_collection.aggregate([{
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
                (await db.collections!.data_collection.aggregate([{
                    $match: { m_studyId: study.id, m_versionId: { $in: availableDataVersions }, m_fieldId: { $in: fileFieldIds } }
                }]).toArray()).forEach(element => {
                    add = add.concat(element.metadata?.add || []);
                    remove = remove.concat(element.metadata?.remove || []);
                });
            } else {
                const subqueries: any = [];
                hasPermission.matchObj.forEach((subMetadata: any) => {
                    subqueries.push(translateMetadata(subMetadata));
                });
                const metadataFilter = { $or: subqueries };
                (await db.collections!.data_collection.aggregate([{
                    $match: { m_studyId: study.id, m_versionId: { $in: availableDataVersions }, m_fieldId: { $in: fileFieldIds } }
                }, {
                    $match: metadataFilter
                }]).toArray()).forEach(element => {
                    add = add.concat(element.metadata?.add || []);
                    remove = remove.concat(element.metadata?.remove || []);
                });
            }
            return await db.collections!.files_collection.find({ $and: [{ id: { $in: add } }, { id: { $nin: remove } }] }).toArray();
        },
        dataVersion: async (project: IProject): Promise<IStudyDataVersion | null> => {
            const study = await db.collections!.studies_collection.findOne({ id: project.studyId, deleted: null });
            if (study === undefined || study === null) {
                return null;
            }
            if (study.currentDataVersion === -1) {
                return null;
            }
            return study.dataVersions[study?.currentDataVersion];
        },
        summary: async (project: IProject, __unused__args: never, context: any): Promise<any> => {
            const summary: any = {};
            const study = await db.collections!.studies_collection.findOne({ id: project.studyId });
            if (study === undefined || study === null || study.currentDataVersion === -1) {
                return summary;
            }

            const requester: IUser = context.req.user;
            /* user can get study if he has readonly permission */
            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                project.studyId
            );
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,
                requester,
                project.studyId,
                project.id
            );
            if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }
            // get all dataVersions that are valid (before the current version)
            const aggregatedPermissions: any = permissionCore.combineMultiplePermissions([hasStudyLevelPermission, hasProjectLevelPermission]);

            let metadataFilter: any = undefined;

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
                fieldRecords = await db.collections!.field_dictionary_collection.aggregate([{
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
                const subqueries: any = [];
                aggregatedPermissions.matchObj.forEach((subMetadata: any) => {
                    subqueries.push(translateMetadata(subMetadata));
                });
                metadataFilter = { $or: subqueries };
                fieldRecords = await db.collections!.field_dictionary_collection.aggregate([{
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
            const pipeline = buildPipeline({}, project.studyId, availableDataVersions, fieldRecords as IFieldEntry[], metadataFilter, requester.type === userTypes.ADMIN);
            const result = await db.collections!.data_collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
            summary['subjects'] = Array.from(new Set(result.map((el: any) => el.m_subjectId))).sort();
            summary['visits'] = Array.from(new Set(result.map((el: any) => el.m_visitId))).sort((a, b) => parseFloat(a) - parseFloat(b)).sort();
            summary['standardizationTypes'] = (await db.collections!.standardizations_collection.distinct('type', { studyId: study.id, deleted: null })).sort();
            return summary;
        },
        patientMapping: async (project: Omit<IProject, 'patientMapping'>, __unused__args: never, context: any): Promise<any> => {
            const requester: IUser = context.req.user;
            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.READ,  // patientMapping is not visible to project users; only to study users.
                requester,
                project.studyId
            ))) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* returning */
            const result =
                await db.collections!.projects_collection.findOne(
                    { id: project.id, deleted: null },
                    { projection: { patientMapping: 1 } }
                );
            if (result && result.patientMapping) {
                return result.patientMapping;
            } else {
                return null;
            }
        },
        roles: async (project: IProject): Promise<Array<any>> => {
            return await db.collections!.roles_collection.find({ studyId: project.studyId, projectId: project.id, deleted: null }).toArray();
        },
        iCanEdit: async (project: IProject): Promise<boolean> => { // TO_DO
            await db.collections!.roles_collection.findOne({
                studyId: project.studyId,
                projectId: project.id
                // permissions: permissions.specific_project.specifi
            });
            return true;
        }
    },
    Mutation: {
        createStudy: async (__unused__parent: Record<string, unknown>, { name, description, type }: { name: string, description: string, type: studyType }, context: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (requester.type !== userTypes.ADMIN) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* create study */
            const study = await studyCore.createNewStudy(name, description, type, requester.id);
            return study;
        },
        editStudy: async (__unused__parent: Record<string, unknown>, { studyId, description }: { studyId: string, description: string }, context: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (requester.type !== userTypes.ADMIN) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* create study */
            const study = await studyCore.editStudy(studyId, description);
            return study;
        },
        createNewField: async (__unused__parent: Record<string, unknown>, { studyId, fieldInput }: { studyId: string, fieldInput: any[] }, context: any): Promise<IGenericResponse[]> => {
            const requester: IUser = context.req.user;
            /* check privileges */
            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.WRITE,
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            // check study exists
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const response: IGenericResponse[] = [];
            let isError = false;
            const bulk = db.collections!.field_dictionary_collection.initializeUnorderedBulkOp();
            // remove duplicates by fieldId
            const keysToCheck = ['fieldId'];
            const filteredFieldInput = fieldInput.filter(
                (s => o => (k => !s.has(k) && s.add(k))(keysToCheck.map(k => o[k]).join('|')))(new Set())
            );
            // check fieldId duplicate
            for (const oneFieldInput of filteredFieldInput) {
                isError = false;
                // check data valid
                if (!(permissionCore.checkDataEntryValid(hasPermission.raw, oneFieldInput.fieldId))) {
                    isError = true;
                    response.push({ successful: false, code: errorCodes.NO_PERMISSION_ERROR, description: 'You do not have permissions to create this field.' });
                    continue;
                }
                const { fieldEntry, error: thisError } = validateAndGenerateFieldEntry(oneFieldInput, requester);
                if (thisError.length !== 0) {
                    response.push({ successful: false, code: errorCodes.CLIENT_MALFORMED_INPUT, description: `Field ${oneFieldInput.fieldId || 'fieldId not defined'}-${oneFieldInput.fieldName || 'fieldName not defined'}: ${JSON.stringify(thisError)}` });
                    isError = true;
                } else {
                    response.push({ successful: true, description: `Field ${oneFieldInput.fieldId}-${oneFieldInput.fieldName} is created successfully.` });
                }
                // // construct the rest of the fields
                if (!isError) {
                    fieldEntry.id = uuid();
                    fieldEntry.studyId = studyId;
                    fieldEntry.dataVersion = null;
                    fieldEntry.dateAdded = (new Date()).valueOf();
                    fieldEntry.dateDeleted = null;
                    fieldEntry.metadata = {
                        uploader: requester.id
                    };
                    bulk.find({
                        fieldId: fieldEntry.fieldId,
                        studyId: studyId,
                        dataVersion: null
                    }).upsert().updateOne({ $set: fieldEntry });
                }
            }
            if (bulk.batches.length > 0) {
                await bulk.execute();
            }
            return response;
        },
        editField: async (__unused__parent: Record<string, unknown>, { studyId, fieldInput }: { studyId: string, fieldInput: any }, context: any): Promise<IFieldEntry> => {
            const requester: IUser = context.req.user;
            /* check privileges */
            if (requester.type !== userTypes.ADMIN) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            // check fieldId exist
            const searchField = await db.collections!.field_dictionary_collection.findOne({ studyId: studyId, fieldId: fieldInput.fieldId, dateDeleted: null });
            if (!searchField) {
                throw new GraphQLError('Field does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
            }
            for (const each of Object.keys(fieldInput) as Array<keyof IFieldEntry>) {
                searchField[each] = fieldInput[each];
            }
            const { fieldEntry, error } = validateAndGenerateFieldEntry(searchField, requester);
            if (error.length !== 0) {
                throw new GraphQLError(JSON.stringify(error), { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
            }
            const newFieldEntry = { ...fieldEntry, id: searchField.id, dateAdded: searchField.dateAdded, deleted: searchField.dateDeleted, studyId: searchField.studyId };
            await db.collections!.field_dictionary_collection.findOneAndUpdate({ studyId: studyId, fieldId: newFieldEntry.fieldId }, { $set: newFieldEntry });

            return newFieldEntry;

        },
        deleteField: async (__unused__parent: Record<string, unknown>, { studyId, fieldId }: { studyId: string, fieldId: string }, context: any): Promise<IFieldEntry> => {
            const requester: IUser = context.req.user;
            /* check privileges */
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.WRITE,
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            if (!(await permissionCore.checkDataEntryValid(hasPermission.raw, fieldId))) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            // check fieldId exist
            const searchField = await db.collections!.field_dictionary_collection.find({ studyId: studyId, fieldId: fieldId }).limit(1).sort({ dateAdded: -1 }).toArray();
            if (searchField.length === 0 || searchField[0].dateDeleted !== null) {
                throw new GraphQLError('Field does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
            }

            const fieldEntry: any = {
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
            await db.collections!.field_dictionary_collection.findOneAndUpdate({
                fieldId: searchField[0].fieldId,
                studyId: studyId,
                dataVersion: null
            }, {
                $set: fieldEntry
            }, {
                upsert: true
            });

            return searchField[0];

        },
        uploadDataInArray: async (__unused__parent: Record<string, unknown>, { studyId, data }: { studyId: string, data: IDataClip[] }, context: any): Promise<IGenericResponse[]> => {
            // check study exists
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const requester: IUser = context.req.user;
            /* check privileges */
            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
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
            const fieldRecords = await db.collections!.field_dictionary_collection.aggregate([{
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
            const fieldsList = fieldRecords.map(el => el.doc).filter(eh => eh.dateDeleted === null);
            const response = (await studyCore.uploadOneDataClip(studyId, hasPermission.raw, fieldsList, data, requester));

            return response;
        },
        deleteDataRecords: async (__unused__parent: Record<string, unknown>, { studyId, subjectIds, visitIds, fieldIds }: { studyId: string, subjectIds: string[], visitIds: string[], fieldIds: string[] }, context: any): Promise<IGenericResponse[]> => {
            // check study exists
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            const response: IGenericResponse[] = [];
            const requester: IUser = context.req.user;
            /* check privileges */
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.WRITE,
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            let validSubjects: string[];
            let validVisits: string[];
            let validFields: any;
            // filter
            if (subjectIds === undefined || subjectIds === null || subjectIds.length === 0) {
                validSubjects = (await db.collections!.data_collection.distinct('m_subjectId', { m_studyId: studyId }));
            } else {
                validSubjects = subjectIds;
            }
            if (visitIds === undefined || visitIds === null || visitIds.length === 0) {
                validVisits = (await db.collections!.data_collection.distinct('m_visitId', { m_studyId: studyId }));
            } else {
                validVisits = visitIds;
            }
            if (fieldIds === undefined || fieldIds === null || fieldIds.length === 0) {
                validFields = (await db.collections!.field_dictionary_collection.distinct('fieldId', { studyId: studyId }));
            } else {
                validFields = fieldIds;
            }

            const bulk = db.collections!.data_collection.initializeUnorderedBulkOp();
            for (const subjectId of validSubjects) {
                for (const visitId of validVisits) {
                    for (const fieldId of validFields) {
                        if (!(await permissionCore.checkDataEntryValid(hasPermission.raw, fieldId, subjectId, visitId))) {
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
        },
        createNewDataVersion: async (__unused__parent: Record<string, unknown>, { studyId, dataVersion, tag }: { studyId: string, dataVersion: string, tag: string }, context: any): Promise<IStudyDataVersion> => {
            // check study exists
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const requester: IUser = context.req.user;

            /* check privileges */
            if (requester.type !== userTypes.ADMIN) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            // check dataVersion name valid
            if (!/^\d{1,3}(\.\d{1,2}){0,2}$/.test(dataVersion)) {
                throw new GraphQLError(errorCodes.CLIENT_MALFORMED_INPUT);
            }

            const created = await studyCore.createNewDataVersion(studyId, tag, dataVersion);
            if (created === null) {
                throw new GraphQLError('No matched or modified records', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
            }
            return created;
        },
        createOntologyTree: async (__unused__parent: Record<string, unknown>, { studyId, ontologyTree }: { studyId: string, ontologyTree: Pick<IOntologyTree, 'name' | 'routes'> }, context: any): Promise<IOntologyTree> => {
            /* check study exists */
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const requester: IUser = context.req.user;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.ontologyTrees,
                atomicOperation.WRITE,
                requester,
                studyId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            // in case of old documents whose ontologyTrees are invalid
            if (study.ontologyTrees === undefined || study.ontologyTrees === null) {
                await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, {
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
            await db.collections!.studies_collection.findOneAndUpdate({
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
            await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: null, ontologyTrees: { $elemMatch: { name: ontologyTreeWithId.name, dataVersion: null } } }, {
                $set: {
                    'ontologyTrees.$.routes': ontologyTreeWithId.routes,
                    'ontologyTrees.$.dataVersion': null,
                    'ontologyTrees.$.deleted': null
                }
            });
            return ontologyTreeWithId as IOntologyTree;
        },
        deleteOntologyTree: async (__unused__parent: Record<string, unknown>, { studyId, treeName }: { studyId: string, treeName: string }, context: any): Promise<IGenericResponse> => {
            /* check study exists */
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const requester: IUser = context.req.user;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.ontologyTrees,
                atomicOperation.WRITE,
                requester,
                studyId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            const resultAdd = await db.collections!.studies_collection.findOneAndUpdate({
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
            const resultUpdate = await db.collections!.studies_collection.findOneAndUpdate({
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

        },
        createProject: async (__unused__parent: Record<string, unknown>, { studyId, projectName }: { studyId: string, projectName: string }, context: any): Promise<IProject> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.own,
                atomicOperation.WRITE,
                requester,
                studyId
            ))) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* making sure that the study exists first */
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            /* create project */
            const project = await studyCore.createProjectForStudy(studyId, projectName, requester.id);
            return project;
        },
        deleteProject: async (__unused__parent: Record<string, unknown>, { projectId }: { projectId: string }, context: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;

            const project = await studyCore.findOneProject_throwErrorIfNotExist(projectId);

            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.own,
                atomicOperation.WRITE,
                requester,
                project.studyId
            ))) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* delete project */
            await studyCore.deleteProject(projectId);
            return makeGenericReponse(projectId);
        },
        deleteStudy: async (__unused__parent: Record<string, unknown>, { studyId }: { studyId: string }, context: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (requester.type !== userTypes.ADMIN) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            const study = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null });

            if (study) {
                /* delete study */
                await studyCore.deleteStudy(studyId);
            } else {
                throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            return makeGenericReponse(studyId);
        },
        setDataversionAsCurrent: async (__unused__parent: Record<string, unknown>, { studyId, dataVersionId }: { studyId: string, dataVersionId: string }, context: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.own,
                atomicOperation.WRITE,
                requester,
                studyId
            ))) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            /* check whether the dataversion exists */
            const selectedataVersionFiltered = study.dataVersions.filter((el) => el.id === dataVersionId);
            if (selectedataVersionFiltered.length !== 1) {
                throw new GraphQLError(errorCodes.CLIENT_MALFORMED_INPUT);
            }

            /* create a new dataversion with the same contentId */
            // const newDataVersion: IStudyDataVersion = {
            //     ...selectedataVersionFiltered[0],
            //     id: uuid()
            // };

            /* add this to the database */
            // const result = await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, {
            //     $push: { dataVersions: newDataVersion }, $inc: { currentDataVersion: 1 }
            // }, { returnDocument: 'after' });

            /* update the currentversion field in database */
            const versionIdsList = study.dataVersions.map((el) => el.id);
            const result = await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, {
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
    },
    Subscription: {}
};

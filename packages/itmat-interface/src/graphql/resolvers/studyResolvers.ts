import { ApolloError } from 'apollo-server-express';
import { Document, Filter } from 'mongodb';
import {
    permissions,
    task_required_permissions,
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
    IGeneralError
} from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { permissionCore } from '../core/permissionCore';
import { validateAndGenerateFieldEntry } from '../core/fieldCore';
import { studyCore } from '../core/studyCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
import { buildPipeline } from '../../utils/query';
import { dataStandardization } from '../../utils/query';

export const studyResolvers = {
    Query: {
        getStudy: async (__unused__parent: Record<string, unknown>, args: Record<string, string>, context: any): Promise<IStudy | null> => {
            const requester: IUser = context.req.user;
            const studyId: string = args.studyId;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const study = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null })!;
            if (study === null || study === undefined) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            return study;
        },
        getProject: async (__unused__parent: Record<string, unknown>, args: any, context: any): Promise<Omit<IProject, 'patientMapping'> | null> => {
            const requester: IUser = context.req.user;
            const projectId: string = args.projectId;

            /* get project */ // defer patientMapping since it's costly and not available to all users
            const project = await db.collections!.projects_collection.findOne({ id: projectId, deleted: null }, { projection: { patientMapping: 0 } })!;
            if (project === null || project === undefined)
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);

            /* check if user has permission */
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_project.specific_project_readonly_access],
                requester,
                project.studyId,
                projectId
            );

            const hasStudyLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                project.studyId
            );
            if (!hasStudyLevelPermission && !hasProjectLevelPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            return project;
        },
        getStudyFields: async (__unused__parent: Record<string, unknown>, { studyId, projectId, versionId }: { studyId: string, projectId?: string, versionId?: string | null }, context: any): Promise<IFieldEntry[]> => {
            const requester: IUser = context.req.user;
            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                studyId
            );
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_project.specific_project_readonly_access],
                requester,
                studyId,
                projectId
            );
            if (!hasPermission && !hasProjectLevelPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }
            // get all dataVersions that are valid (before the current version)
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            const fieldRecords = (hasPermission && versionId === null) ? await db.collections!.field_dictionary_collection.aggregate([{
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
            ]).toArray() : await db.collections!.field_dictionary_collection.aggregate([{
                $sort: { dateAdded: -1 }
            }, {
                $match: { dataVersion: { $in: availableDataVersions } }
            }, {
                $match: { studyId: studyId }
            }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $first: '$$ROOT' }
                }
            }
            ]).toArray();
            return fieldRecords.map(el => el.doc).filter(eh => eh.dateDeleted === null);
        },
        getOntologyTree: async (__unused__parent: Record<string, unknown>, { studyId, projectId, treeId }: { studyId: string, projectId: string, treeId: string }, context: any): Promise<IOntologyTree[]> => {
            /* get studyId by parameter or project */
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            if (projectId) {
                await studyCore.findOneProject_throwErrorIfNotExist(projectId);
            }

            const requester: IUser = context.req.user;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                studyId
            );
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_project.specific_project_readonly_access],
                requester,
                studyId,
                projectId
            );
            if (!hasPermission && !hasProjectLevelPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            if (treeId) {
                return study.ontologyTrees?.filter(el => el.id === treeId) || [];
            } else {
                return study.ontologyTrees || [];
            }
        },
        checkDataComplete: async (__unused__parent: Record<string, unknown>, { studyId }: { studyId: string }, context: any): Promise<any> => {
            const requester: IUser = context.req.user;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management],
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            // we only check data that hasnt been pushed to a new data version
            const data: any[] = await db.collections!.data_collection.find({ m_studyId: studyId, m_versionId: null }).toArray();
            const fieldRecords = (await db.collections!.field_dictionary_collection.aggregate([{
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
            ]).toArray()).map(el => el.doc).filter(eh => eh.dateDeleted === null);
            const summary: ISubjectDataRecordSummary[] = [];
            // we will not check data whose fields are not defined, because data that the associated fields are undefined will not be returned while querying data
            for (const record of data) {
                const errors: any[] = [];
                for (const field of fieldRecords) {
                    if (record[field.fieldId] !== undefined && record[field.fieldId] !== null) {
                        switch (field.dataType) {
                            case 'dec': {// decimal
                                if (!/^\d+(.\d+)?$/.test(record[field])) {
                                    errors.push(`Field ${field.fieldId}-${field.fieldName}: Cannot parse as decimal.`);
                                    break;
                                }
                                break;
                            }
                            case 'int': {// integer
                                if (!/^-?\d+$/.test(record[field.fieldId])) {
                                    errors.push(`Field ${field.fieldId}-${field.fieldName}: Cannot parse as integer.`);
                                    break;
                                }
                                break;
                            }
                            case 'bool': {// boolean
                                if (record[field.fieldId].value.toLowerCase() !== 'true' && record[field.fieldId].value.toLowerCase() !== 'false') {
                                    errors.push(`Field ${field.fieldId}-${field.fieldName}: Cannot parse as boolean.`);
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
                                if (!record[field.fieldId].value.match(matcher)) {
                                    errors.push(`Field ${field.fieldId}-${field.fieldName}: Cannot parse as data. Value for date type must be in ISO format.`);
                                    break;
                                }
                                break;
                            }
                            case 'json': {
                                break;
                            }
                            case 'file': {
                                const file = await db.collections!.files_collection.findOne({ id: record[field.fieldId] });
                                if (!file) {
                                    errors.push(`Field ${field.fieldId}-${field.fieldName}: Cannot parse as file or file does not exist.`);
                                    break;
                                }
                                break;
                            }
                            case 'cat': {
                                if (!field.possibleValues.map((el: any) => el.code).includes(record[field.fieldId].toString())) {
                                    errors.push(`Field ${field.fieldId}-${field.fieldName}: Cannot parse as categorical, value not in value list.`);
                                    break;
                                }
                                break;
                            }
                            default: {
                                errors.push(`Field ${field.fieldId}-${field.fieldName}: Invalid data Type.`);
                                break;
                            }
                        }
                    }
                }
                summary.push({
                    subjectId: record.m_subjectId,
                    visitId: record.m_visitId,
                    errorFields: errors
                });
            }

            return summary;
        },
        getDataRecords: async (__unused__parent: Record<string, unknown>, { studyId, queryString, versionId, projectId }: { queryString: any, studyId: string, versionId: string, projectId?: string }, context: any): Promise<any> => {
            const requester: IUser = context.req.user;
            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management, permissions.specific_project.specific_project_readonly_access],
                requester,
                studyId
            );
            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_project.specific_project_readonly_access],
                requester,
                studyId,
                projectId
            );
            if (!hasPermission && !hasProjectLevelPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            // check data access permissions
            // null: user will access all data; undefined: user should not access any data
            let siteIDMarker: string | undefined | null = undefined;
            if (requester.type === userTypes.ADMIN || !(await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_own_organisation_only, permissions.specific_project.specific_project_data_own_organisation_only],
                requester,
                studyId,
                projectId
            ))) {
                siteIDMarker = null;
            } else {
                siteIDMarker = (await db.collections!.organisations_collection.findOne({ id: requester.organisation }))?.metadata?.siteIDMarker;
            }

            // if the user has necessary permission, the latest field and data (including unversioned) will both be used to validate and returned;
            // else only the latest versioned field and data will be used
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            let availableDataVersions: any;
            // standard users can only access the data of the current version (in this case they shouldn't specify the versionids)
            if (versionId === undefined || versionId === null) {
                availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            } else {
                if (hasPermission) {
                    availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.dataVersions.map(el => el.id).indexOf(versionId))).map(el => el.id);
                } else {
                    throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
                }
            }
            // get the fields list, this is to make sure that only data with valid fields are returned, method same as getStudyFields
            const fieldRecords: any[] = (hasPermission && versionId === null) ? await db.collections!.field_dictionary_collection.aggregate([{
                $match: { $or: [{ dataVersion: null }, { dataVersion: { $in: availableDataVersions } }] }
            }, {
                $match: { studyId: studyId, dateDeleted: null }
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
            }
            ]).toArray() : await db.collections!.field_dictionary_collection.aggregate([{
                $match: { dataVersion: { $in: availableDataVersions } }
            }, {
                $match: { studyId: studyId, dateDeleted: null }
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
            }
            ]).toArray();
            const fieldsIds: string[] = [];
            for (let i = 0; i < fieldRecords.length; i++) {
                fieldsIds.push(fieldRecords[i].fieldId);
            }
            const pipeline = buildPipeline(queryString, studyId, availableDataVersions, hasPermission && versionId === null, fieldsIds, siteIDMarker);
            const result = await db.collections!.data_collection.aggregate(pipeline).toArray();
            // post processing the data
            // 1. update to the latest data; start from latest record
            const groupedResult: any = {};
            for (let i = 0; i < result.length; i++) {
                if (groupedResult[result[i]['m_subjectId']] === undefined) {
                    groupedResult[result[i]['m_subjectId']] = {};
                }
                if (groupedResult[result[i]['m_subjectId']][result[i]['m_visitId']] === undefined) {
                    groupedResult[result[i]['m_subjectId']][result[i]['m_visitId']] = {};
                }
                groupedResult[result[i]['m_subjectId']][result[i]['m_visitId']] = { ...groupedResult[result[i]['m_subjectId']][result[i]['m_visitId']], ...result[i] };
                for (const field of Object.keys(result[i])) {
                    if (groupedResult[result[i]['m_subjectId']][result[i]['m_visitId']][field] === undefined || groupedResult[result[i]['m_subjectId']][result[i]['m_visitId']][field] === null) {
                        groupedResult[result[i]['m_subjectId']][result[i]['m_visitId']][field] = result[i][field];
                    }
                }
            }
            // 2. adjust format: 1) original (exists) 2) standardized-$name 3) grouped
            const standardizations = await db.collections!.standardizations_collection.find({ studyId: studyId, type: queryString['format'].split('-')[1], delete: null }).toArray();
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
            if (requester.type === userTypes.ADMIN || !(await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_own_organisation_only],
                requester,
                study.id
            ))) {
                return await db.collections!.files_collection.find({ studyId: study.id, deleted: null }).toArray();
            } else {
                const siteIDMarker: string | undefined = (await db.collections!.organisations_collection.findOne({ id: requester.organisation }))?.metadata?.siteIDMarker;
                if (!siteIDMarker) {
                    return [];
                } else {
                    return await db.collections!.files_collection.find({ studyId: study.id, deleted: null, fileName: { $regex: new RegExp('^' + siteIDMarker + '(.{6})-(.{3})(.{6})-(\\d{8})-(\\d{8})\\.(.*)$') } }).toArray();
                }
            }

        },
        subjects: async (study: IStudy): Promise<string[]> => {
            return study.currentDataVersion === -1 ? [] : await db.collections!.data_collection.distinct('m_subjectId', { m_studyId: study.id, m_versionId: study.dataVersions[study.currentDataVersion].id });
        },
        visits: async (study: IStudy): Promise<string[]> => {
            return study.currentDataVersion === -1 ? [] : await db.collections!.data_collection.distinct('m_visitId', { m_studyId: study.id, m_versionId: study.dataVersions[study.currentDataVersion].id });
        },
        numOfRecords: async (study: IStudy): Promise<number> => {
            if (study.currentDataVersion === -1) {
                return 0;
            }
            return study.currentDataVersion === -1 ? 0 : (await db.collections!.data_collection.find({ m_studyId: study.id, m_versionId: study.dataVersions[study.currentDataVersion].id }).toArray()).length;
        },
        currentDataVersion: async (study: IStudy): Promise<null | number> => {
            return study.currentDataVersion === -1 ? null : study.currentDataVersion;
        }
    },
    Project: {
        fields: async (project: Omit<IProject, 'patientMapping'>): Promise<Array<IFieldEntry>> => {
            const approvedFields = ([] as string[]).concat(...Object.values(project.approvedFields) as string[]);
            const result = await db.collections!.field_dictionary_collection.find({ studyId: project.studyId, id: { $in: approvedFields }, dateDeleted: null }).toArray();
            return result;
        },
        jobs: async (project: Omit<IProject, 'patientMapping'>): Promise<Array<IJobEntry<any>>> => {
            return await db.collections!.jobs_collection.find({ studyId: project.studyId, projectId: project.id }).toArray();
        },
        files: async (project: Omit<IProject, 'patientMapping'>, __unused__args: never, context: any): Promise<Array<IFile>> => {
            const requester: IUser = context.req.user;
            if (requester.type === userTypes.ADMIN || !(await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_own_organisation_only, permissions.specific_project.specific_project_data_own_organisation_only],
                requester,
                project.studyId,
                project.id
            ))) {
                return await db.collections!.files_collection.find({ studyId: project.studyId, id: { $in: project.approvedFiles }, deleted: null }).toArray();
            } else {
                const siteIDMarker: string | undefined = (await db.collections!.organisations_collection.findOne({ id: requester.organisation }))?.metadata?.siteIDMarker;
                if (!siteIDMarker) {
                    return [];
                } else {
                    return await db.collections!.files_collection.find({ studyId: project.studyId, id: { $in: project.approvedFiles }, deleted: null, fileName: { $regex: new RegExp('^' + siteIDMarker + '(.{6})-(.{3})(.{6})-(\\d{8})-(\\d{8})\\.(.*)$') } }).toArray();
                }
            }
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
        summary: async (project: IProject): Promise<any> => {
            const summary: any = {};
            const study = await db.collections!.studies_collection.findOne({ id: project.studyId });
            if (study === undefined || study === null || study.currentDataVersion === -1) {
                return summary;
            }
            const availableDataVersions: Array<string | null> = study.dataVersions.filter(el => study.dataVersions.indexOf(el) <= study.currentDataVersion).map(es => es.id);
            summary['subjects'] = study.currentDataVersion === -1 ? [] : await db.collections!.data_collection.distinct('m_subjectId', { m_studyId: study.id, m_versionId: { $in: availableDataVersions } } as Filter<Document>);
            summary['visits'] = study.currentDataVersion === -1 ? [] : await db.collections!.data_collection.distinct('m_visitId', { m_studyId: study.id, m_versionId: { $in: availableDataVersions } } as Filter<Document>);
            return summary;
        },
        patientMapping: async (project: Omit<IProject, 'patientMapping'>, __unused__args: never, context: any): Promise<any> => {
            const requester: IUser = context.req.user;
            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.access_study_data,  // patientMapping is not visible to project users; only to study users.
                requester,
                project.studyId
            ))) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
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
        approvedFields: async (project: IProject, __unused__args: never, context: any): Promise<Record<string, any>> => {
            const requester: IUser = context.req.user;
            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_projects.concat(task_required_permissions.access_project_data),
                requester,
                project.studyId,
                project.id
            ))) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            return project.approvedFields;
        },
        approvedFiles: async (project: IProject, __unused__args: never, context: any): Promise<string[]> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_projects.concat(task_required_permissions.access_project_data),
                requester,
                project.studyId,
                project.id
            ))) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            return project.approvedFiles;
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
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* create study */
            const study = await studyCore.createNewStudy(name, description, type, requester.id);
            return study;
        },
        editStudy: async (__unused__parent: Record<string, unknown>, { studyId, description }: { studyId: string, description: string }, context: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (requester.type !== userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* create study */
            const study = await studyCore.editStudy(studyId, description);
            return study;
        },
        createNewField: async (__unused__parent: Record<string, unknown>, { studyId, fieldInput }: { studyId: string, fieldInput: any[] }, context: any): Promise<IGeneralError[]> => {
            const requester: IUser = context.req.user;
            /* check privileges */
            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management],
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            // check study exists
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const error: IGeneralError[] = [];
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
                const { fieldEntry, error: thisError } = validateAndGenerateFieldEntry(oneFieldInput);
                if (thisError.length !== 0) {
                    error.push({ code: errorCodes.CLIENT_MALFORMED_INPUT, description: `Field ${oneFieldInput.fieldId || 'fieldId not defined'}-${oneFieldInput.fieldName || 'fieldName not defined'}: ${JSON.stringify(thisError)}` });
                    isError = true;
                }

                // // construct the rest of the fields
                if (!isError) {
                    fieldEntry.id = uuid();
                    fieldEntry.studyId = studyId;
                    fieldEntry.dataVersion = null;
                    fieldEntry.dateAdded = (new Date()).valueOf();
                    fieldEntry.dateDeleted = null;
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
            return error;
        },
        editField: async (__unused__parent: Record<string, unknown>, { studyId, fieldInput }: { studyId: string, fieldInput: any }, context: any): Promise<IFieldEntry> => {
            const requester: IUser = context.req.user;
            /* check privileges */
            if (requester.type !== userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            // check fieldId exist
            const searchField = await db.collections!.field_dictionary_collection.findOne({ studyId: studyId, fieldId: fieldInput.fieldId, dateDeleted: null });
            if (!searchField) {
                throw new ApolloError('Field does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            for (const each of Object.keys(fieldInput) as Array<keyof IFieldEntry>) {
                searchField[each] = fieldInput[each];
            }
            const { fieldEntry, error } = validateAndGenerateFieldEntry(searchField);
            if (error.length !== 0) {
                throw new ApolloError(JSON.stringify(error), errorCodes.CLIENT_MALFORMED_INPUT);
            }
            const newFieldEntry = { ...fieldEntry, id: searchField.id, dateAdded: searchField.dateAdded, deleted: searchField.dateDeleted, studyId: searchField.studyId };
            await db.collections!.field_dictionary_collection.findOneAndUpdate({ studyId: studyId, fieldId: newFieldEntry.fieldId }, { $set: newFieldEntry });

            return newFieldEntry;

        },
        deleteField: async (__unused__parent: Record<string, unknown>, { studyId, fieldId }: { studyId: string, fieldId: string }, context: any): Promise<IFieldEntry> => {
            const requester: IUser = context.req.user;
            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                studyId
            ))) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            // check fieldId exist
            const searchField = await db.collections!.field_dictionary_collection.find({ studyId: studyId, fieldId: fieldId }).limit(1).sort({ dateAdded: -1 }).toArray();
            if (searchField.length === 0 || searchField[0].dateDeleted !== null) {
                throw new ApolloError('Field does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
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
        uploadDataInArray: async (__unused__parent: Record<string, unknown>, { studyId, data }: { studyId: string, data: IDataClip[] }, context: any): Promise<IGeneralError> => {
            // check study exists
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const requester: IUser = context.req.user;
            /* check privileges */
            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management],
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
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
            const errors = (await studyCore.uploadOneDataClip(studyId, fieldsList, data, requester));

            return errors;
        },
        deleteDataRecords: async (__unused__parent: Record<string, unknown>, { studyId, subjectIds, visitIds, fieldIds }: { studyId: string, subjectIds: string[], visitIds: string[], fieldIds: string[] }, context: any): Promise<any> => {
            // check study exists
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const requester: IUser = context.req.user;
            /* check privileges */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management],
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            let validSubjects: any;
            let validVisits: any;
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
                validFields = (await db.collections!.field_dictionary_collection.distinct('fieldId', { studyId: studyId })).reduce<any>((acc, curr) => { acc[curr] = null; return acc; }, {});
            } else {
                validFields = fieldIds.reduce<any>((acc, curr) => { acc[curr] = null; return acc; }, {});
            }

            const bulk = db.collections!.data_collection.initializeUnorderedBulkOp();
            for (const subjectId of validSubjects) {
                for (const visitId of validVisits) {
                    bulk.find({ m_studyId: studyId, m_subjectId: subjectId, m_visitId: visitId, m_versionId: null }).upsert().updateOne({
                        $set: {
                            ...validFields,
                            m_studyId: studyId,
                            m_subjectId: subjectId,
                            m_visitId: visitId,
                            m_versionId: null,
                            uploadedAt: (new Date()).valueOf(),
                            id: uuid()
                        }
                    });
                }
            }
            if (bulk.batches.length > 0) {
                await bulk.execute();
            }
            return [];
        },
        createNewDataVersion: async (__unused__parent: Record<string, unknown>, { studyId, dataVersion, tag }: { studyId: string, dataVersion: string, tag: string }, context: any): Promise<IStudyDataVersion> => {
            // If base versions are specified, the new data version will conbine the data that either belongs to the dataVersion or null;
            // All the data will be filtered by subjectIds and visitIds then if they are specified;
            // e.g.
            // only use data without version: baseVersions: null;  with filter: subjectIds: [...], visitIds: [...]
            // create from a base: baseVersions: [...]
            // If create a totally new version (i.e., can not be created by inherite from a base version), select all versions in baseVersions then use the filter;

            // check study exists
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const requester: IUser = context.req.user;

            /* check privileges */
            if (requester.type !== userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            // check dataVersion name valid
            if (!/^\d{1,3}(\.\d{1,2}){0,2}$/.test(dataVersion)) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
            }

            const created = await studyCore.createNewDataVersion(studyId, tag, dataVersion);
            if (created === null) {
                throw new ApolloError('No matched or modified records', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            return created;
        },
        createOntologyTree: async (__unused__parent: Record<string, unknown>, { studyId, ontologyTree }: { studyId: string, ontologyTree: IOntologyTree }, context: any): Promise<IOntologyTree> => {
            /* check study exists */
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const requester: IUser = context.req.user;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management],
                requester,
                studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            // in case of old documents whose ontologyTrees are invalid
            if (study.ontologyTrees === undefined || ontologyTree === null) {
                await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, {
                    $set: {
                        ontologyTrees: []
                    }
                });
            }
            const ontologyTreeWithId: IOntologyTree = { ...ontologyTree };
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
                            name: ontologyTree.name
                        }
                    }
                }
            }, {
                $addToSet: {
                    ontologyTrees: ontologyTreeWithId
                }
            });
            await db.collections!.studies_collection.findOneAndUpdate({ 'id': studyId, 'deleted': null, 'ontologyTrees.name': ontologyTree.name }, {
                $set: {
                    'ontologyTrees.$.routes': ontologyTreeWithId.routes
                }
            });

            return ontologyTreeWithId;
        },
        deleteOntologyTree: async (__unused__parent: Record<string, unknown>, { studyId, treeId }: { studyId: string, treeId: string }, context: any): Promise<IGenericResponse> => {
            /* check study exists */
            await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            const requester: IUser = context.req.user;

            /* user can get study if he has readonly permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management],
                requester,
                studyId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            const result = await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, {
                $pull: {
                    ontologyTrees: {
                        id: treeId
                    }
                }
            }, {
                returnDocument: 'after'
            });
            if (result.ok === 1 && result.value) {
                return makeGenericReponse(treeId);
            } else {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }

        },
        createProject: async (__unused__parent: Record<string, unknown>, { studyId, projectName }: { studyId: string, projectName: string }, context: any): Promise<IProject> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_projects,
                requester,
                studyId
            ))) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
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
            if (!(await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_projects,
                requester,
                project.studyId
            ))) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* delete project */
            await studyCore.deleteProject(projectId);
            return makeGenericReponse(projectId);
        },
        deleteStudy: async (__unused__parent: Record<string, unknown>, { studyId }: { studyId: string }, context: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (requester.type !== userTypes.ADMIN) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            const study = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null });

            if (study) {
                /* delete study */
                await studyCore.deleteStudy(studyId);
            } else {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            return makeGenericReponse(studyId);
        },
        editProjectApprovedFields: async (__unused__parent: Record<string, unknown>, { projectId, approvedFields }: { projectId: string, approvedFields: string[] }, context: any): Promise<IProject> => {
            const requester: IUser = context.req.user;

            /* check study id for the project */
            const project = await studyCore.findOneProject_throwErrorIfNotExist(projectId);

            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_projects,
                requester,
                project.studyId
            ))) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* check field tree exists */
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(project.studyId);
            const currentDataVersion = study.dataVersions[study.currentDataVersion];
            if (!currentDataVersion) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* check all the fields are valid */
            const activefields = await db.collections!.field_dictionary_collection.find({ id: { $in: approvedFields }, studyId: project.studyId, dateDeleted: null }).toArray();
            if (activefields.length !== approvedFields.length) {
                throw new ApolloError('Some of the fields provided in your changes are not valid.', errorCodes.CLIENT_MALFORMED_INPUT);
            }


            /* edit approved fields */
            const resultingProject = await studyCore.editProjectApprovedFields(projectId, approvedFields);
            return resultingProject;
        },
        editProjectApprovedFiles: async (__unused__parent: Record<string, unknown>, { projectId, approvedFiles }: { projectId: string, approvedFiles: string[] }, context: any): Promise<IProject> => {
            const requester: IUser = context.req.user;

            /* check study id for the project */
            const project = await studyCore.findOneProject_throwErrorIfNotExist(projectId);

            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_projects,
                requester,
                project.studyId
            ))) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* check all the files are valid */
            const activefiles = await db.collections!.files_collection.find({ id: { $in: approvedFiles }, deleted: null }).toArray();
            if (activefiles.length !== approvedFiles.length) {
                throw new ApolloError('Some of the files provided in your changes are not valid.', errorCodes.CLIENT_MALFORMED_INPUT);
            }

            /* edit approved fields */
            const resultingProject = await studyCore.editProjectApprovedFiles(projectId, approvedFiles);
            return resultingProject;
        },
        setDataversionAsCurrent: async (__unused__parent: Record<string, unknown>, { studyId, dataVersionId }: { studyId: string, dataVersionId: string }, context: any): Promise<IStudy> => {
            const requester: IUser = context.req.user;

            /* check privileges */
            if (!(await permissionCore.userHasTheNeccessaryPermission(
                task_required_permissions.manage_study_data,
                requester,
                studyId
            ))) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            const study = await studyCore.findOneStudy_throwErrorIfNotExist(studyId);

            /* check whether the dataversion exists */
            const selectedataVersionFiltered = study.dataVersions.filter((el) => el.id === dataVersionId);
            if (selectedataVersionFiltered.length !== 1) {
                throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
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

            // update the field Id of the approved fields of each project
            // get fields that are valid of the curretn data version
            const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            const fieldRecords = await db.collections!.field_dictionary_collection.aggregate([{
                $sort: { dateAdded: -1 }
            }, {
                $match: { dataVersion: { $in: availableDataVersions } }
            }, {
                $match: { studyId: studyId }
            }, {
                $group: {
                    _id: '$fieldId',
                    doc: { $first: '$$ROOT' }
                }
            }
            ]).toArray();
            const validFields = fieldRecords.map(el => el.doc).filter(eh => eh.dateDeleted === null);
            const validFieldsIds = validFields.map(el => el.fieldId);


            const fieldsToReplace: string[] = [];
            // Replace fields whose fieldId exists in both original approved fields and valid fields of the current version
            const projects = await db.collections!.projects_collection.find({ studyId: studyId, deleted: null }).toArray();
            for (const project of projects) {
                const originalApprovedFieldsInfo = await db.collections!.field_dictionary_collection.find({ id: { $in: project.approvedFields } }).toArray();
                for (const each of originalApprovedFieldsInfo) {
                    if (validFieldsIds.includes(each.fieldId)) {
                        fieldsToReplace.push(validFields.filter(el => el.fieldId === each.fieldId)[0].id);
                    }
                }
                await db.collections!.projects_collection.findOneAndUpdate({ studyId: project.studyId, id: project.id, deleted: null }, {
                    $set: {
                        approvedFields: fieldsToReplace
                    }
                });
            }


            /* update the currentversion field in database */
            const versionIdsList = study.dataVersions.map((el) => el.id);
            const result = await db.collections!.studies_collection.findOneAndUpdate({ id: studyId, deleted: null }, {
                $set: { currentDataVersion: versionIdsList.indexOf(dataVersionId) }
            }, {
                returnDocument: 'after'
            });

            if (result.ok === 1 && result.value) {
                return result.value;
            } else {
                throw new ApolloError(errorCodes.DATABASE_ERROR);
            }



        }
    },
    Subscription: {}
};

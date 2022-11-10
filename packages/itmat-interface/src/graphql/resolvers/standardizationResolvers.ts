import { permissions, IProject, IStandardization, IUser } from '@itmat-broker/itmat-types';
import { permissionCore } from '../core/permissionCore';
import { studyCore } from '../core/studyCore';
import { ApolloError } from 'apollo-server-express';
import { errorCodes } from '../errors';
import { db } from '../../database/database';
import { v4 as uuid } from 'uuid';
import { IGenericResponse, makeGenericReponse } from '../responses';

export const standardizationResolvers = {
    Query: {
        getStandardization: async (__unused__parent: Record<string, unknown>, { studyId, projectId, type, versionId }: { studyId: string, projectId: string, type: string, versionId: string }, context: any): Promise<IStandardization[]> => {
            let modifiedStudyId = studyId;
            /* check study exists */
            if (!studyId && !projectId) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, 'Either studyId or projectId should be provided.');
            }
            if (studyId) {
                await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            }
            if (projectId) {
                const project: IProject = await studyCore.findOneProject_throwErrorIfNotExist(projectId);
                modifiedStudyId = project.studyId;
            }
            const requester: IUser = context.req.user;
            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_readonly_access],
                requester,
                modifiedStudyId
            );

            const hasProjectLevelPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_project.specific_project_readonly_access],
                requester,
                modifiedStudyId,
                projectId
            );
            if (!hasPermission && !hasProjectLevelPermission) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }
            const study = await studyCore.findOneStudy_throwErrorIfNotExist(modifiedStudyId);
            let availableTypes: string[] = [];
            if (type) {
                availableTypes.push(type);
            } else {
                availableTypes = await db.collections!.standardizations_collection.distinct('type', { studyId: studyId });
            }
            // get all dataVersions that are valid (before/equal the current version)
            const availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            const standardizations = (hasPermission && versionId === null) ? await db.collections!.standardizations_collection.aggregate([{
                $sort: { uploadedAt: -1 }
            }, {
                $match: { $or: [{ dataVersion: null }, { dataVersion: { $in: availableDataVersions } }] }
            }, {
                $match: { studyId: studyId, type: { $in: availableTypes } }
            }, {
                $group: {
                    _id: {
                        type: '$type',
                        field: '$field'
                    },
                    doc: { $first: '$$ROOT' }
                }
            }, {
                $replaceRoot: { newRoot: '$doc' }
            }
            ]).toArray() : await db.collections!.standardizations_collection.aggregate([{
                $sort: { uploadedAt: -1 }
            }, {
                $match: { dataVersion: { $in: availableDataVersions } }
            }, {
                $match: { studyId: studyId, type: { $in: availableTypes } }
            }, {
                $group: {
                    _id: {
                        type: '$type',
                        field: '$field'
                    },
                    doc: { $first: '$$ROOT' }
                }
            }, {
                $replaceRoot: { newRoot: '$doc' }
            }, {
                $match: { deleted: null }
            }
            ]).toArray();
            return standardizations as IStandardization[];
        }
    },
    Mutation: {
        createStandardization: async (__unused__parent: Record<string, unknown>, { studyId, standardization }: { studyId: string, standardization: any }, context: any): Promise<IStandardization> => {
            const requester: IUser = context.req.user;
            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management],
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* check study exists */
            const studySearchResult = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null });
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new ApolloError('Study does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }
            const stdRulesWithId: any[] = [...standardization.stdRules];
            stdRulesWithId.forEach(el => {
                el.id = uuid();
            });
            const standardizationEntry: IStandardization = {
                id: uuid(),
                studyId: studyId,
                type: standardization.type,
                field: standardization.field,
                path: standardization.path,
                stdRules: stdRulesWithId || [],
                joinByKeys: standardization.joinByKeys || [],
                dataVersion: null,
                uploadedAt: Date.now(),
                deleted: null
            };

            await db.collections!.standardizations_collection.findOneAndUpdate({ studyId: studyId, type: standardization.type, field: standardization.field, dataVersion: null }, {
                $set: { ...standardizationEntry }
            }, {
                upsert: true
            });
            return standardizationEntry;
        },
        deleteStandardization: async (__unused__parent: Record<string, unknown>, { studyId, type, field }: { studyId: string, type: string, field: string[] }, context: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;
            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management],
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new ApolloError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* check study exists */
            const studySearchResult = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null });
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new ApolloError('Study does not exist.', errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            // check type exists
            const types: string[] = await db.collections!.standardizations_collection.distinct('type', { studyId: studyId, deleted: null });
            if (!types.includes(type)) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, 'Type does not exist.');
            }
            const result = await db.collections!.standardizations_collection.findOneAndUpdate({ studyId: studyId, field: field, type: type, dataVersion: null }, {
                $set: {
                    id: uuid(),
                    studyId: studyId,
                    field: field,
                    type: type,
                    dataVersion: null,
                    uploadedAt: Date.now(),
                    deleted: Date.now()
                }
            }, {
                upsert: true
            });
            return makeGenericReponse(result.value?.id || '');
        }
    },
    Subscription: {}
};

// function checkFieldEqual(fieldA: string[], fieldB: string[]) {
//     return fieldA.length === fieldB.length && fieldA.every((value, index) => {
//         return value === fieldB[index];
//     });
// }

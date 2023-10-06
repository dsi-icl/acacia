import { IProject, IStandardization, IUser, atomicOperation } from '@itmat-broker/itmat-types';
import { permissionCore } from '../core/permissionCore';
import { studyCore } from '../core/studyCore';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../errors';
import { db } from '../../database/database';
import { v4 as uuid } from 'uuid';
import { IGenericResponse, makeGenericReponse } from '../responses';

export const standardizationResolvers = {
    Query: {
        getStandardization: async (__unused__parent: Record<string, unknown>, { studyId, projectId, type, versionId }: { studyId: string, projectId: string, type?: string, versionId: string }, context: any): Promise<IStandardization[]> => {
            const requester: IUser = context.req.user;
            let modifiedStudyId = studyId;
            /* check study exists */
            if (!studyId && !projectId) {
                throw new GraphQLError('Either studyId or projectId should be provided.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
            }
            if (studyId) {
                await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            }
            if (projectId) {
                const project: IProject = await studyCore.findOneProject_throwErrorIfNotExist(projectId);
                modifiedStudyId = project.studyId;
            }

            /* check permission */
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

            const study = await studyCore.findOneStudy_throwErrorIfNotExist(modifiedStudyId);
            // get all dataVersions that are valid (before/equal the current version)
            const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            if (hasStudyLevelPermission && hasStudyLevelPermission.hasVersioned && versionId === null) {
                availableDataVersions.push(null);
            }
            const standardizations = await db.collections!.standardizations_collection.aggregate([{
                $sort: { uploadedAt: -1 }
            }, {
                $match: { dataVersion: { $in: availableDataVersions } }
            }, {
                $match: { studyId: studyId, type: type ?? /^.*$/ }
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
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.WRITE,
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            /* check study exists */
            const studySearchResult = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null });
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new GraphQLError('Study does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
            }
            const stdRulesWithId: any[] = [...standardization.stdRules];
            stdRulesWithId.forEach(el => {
                el.id = uuid();
            });
            if (!(permissionCore.checkDataEntryValid(hasPermission.raw, standardization.field[0].slice(1)))) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }
            const standardizationEntry: IStandardization = {
                id: uuid(),
                studyId: studyId,
                type: standardization.type,
                field: standardization.field,
                path: standardization.path,
                stdRules: stdRulesWithId || [],
                joinByKeys: standardization.joinByKeys || [],
                dataVersion: null,
                metadata: standardization.metadata,
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
            const hasPermission = await permissionCore.userHasTheNeccessaryDataPermission(
                atomicOperation.WRITE,
                requester,
                studyId
            );
            if (!hasPermission) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }
            if (!(permissionCore.checkDataEntryValid(hasPermission.raw, field[0].slice(1)))) {
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }
            /* check study exists */
            const studySearchResult = await db.collections!.studies_collection.findOne({ id: studyId, deleted: null });
            if (studySearchResult === null || studySearchResult === undefined) {
                throw new GraphQLError('Study does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
            }

            // check type exists
            const types: string[] = await db.collections!.standardizations_collection.distinct('type', { studyId: studyId, deleted: null });
            if (!types.includes(type)) {
                throw new GraphQLError('Type does not exist.', { extensions: { code: errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY } });
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
            return makeGenericReponse(result?.id || '');
        }
    },
    Subscription: {}
};

// function checkFieldEqual(fieldA: string[], fieldB: string[]) {
//     return fieldA.length === fieldB.length && fieldA.every((value, index) => {
//         return value === fieldB[index];
//     });
// }

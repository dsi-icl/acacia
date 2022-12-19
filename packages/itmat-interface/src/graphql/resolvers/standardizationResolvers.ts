import { permissions, IProject, IStandardization, IUser } from '@itmat-broker/itmat-types';
import { permissionCore } from '../core/permissionCore';
import { studyCore } from '../core/studyCore';
import { GraphQLError } from 'graphql';
import { errorCodes } from '../errors';
import { db } from '../../database/database';
import { v4 as uuid } from 'uuid';
import { IGenericResponse, makeGenericReponse } from '../responses';

export const standardizationResolvers = {
    Query: {
        getStandardization: async (__unused__parent: Record<string, unknown>, { studyId, projectId, type }: { studyId: string, projectId: string, type: string }, context: any): Promise<IStandardization[]> => {
            let modifiedStudyId = studyId;

            /* check study exists */
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
                throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR);
            }

            let standardizations: IStandardization[] = [];
            if (type) {
                standardizations = await db.collections!.standardizations_collection.find({
                    studyId: studyId,
                    type: type,
                    deleted: null
                }).toArray();
            } else {
                standardizations = await db.collections!.standardizations_collection.find({
                    studyId: studyId,
                    deleted: null
                }).toArray();
            }
            return standardizations;
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
            const standardizationEntry: IStandardization = {
                id: uuid(),
                studyId: studyId,
                type: standardization.type,
                field: standardization.field,
                path: standardization.path,
                stdRules: stdRulesWithId || [],
                joinByKeys: standardization.joinByKeys || [],
                deleted: null
            };

            await db.collections!.standardizations_collection.findOneAndUpdate({ studyId: studyId, type: standardization.type, field: standardization.field }, {
                $set: { ...standardizationEntry }
            }, {
                upsert: true
            });
            return standardizationEntry;
        },
        deleteStandardization: async (__unused__parent: Record<string, unknown>, { studyId, stdId }: { studyId: string, stdId: string }, context: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;
            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                [permissions.specific_study.specific_study_data_management],
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

            const result = await db.collections!.standardizations_collection.findOneAndUpdate({ studyId: studyId, id: stdId }, {
                $set: {
                    deleted: Date.now()
                }
            }, {
                returnDocument: 'before'
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

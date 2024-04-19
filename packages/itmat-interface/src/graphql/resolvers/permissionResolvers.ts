import { GraphQLError } from 'graphql';
import { IRole, atomicOperation, IPermissionManagementOptions } from '@itmat-broker/itmat-types';
import { db } from '../../database/database';
import { permissionCore } from '../core/permissionCore';
import { studyCore } from '../core/studyCore';
import { errorCodes } from '../errors';
import { makeGenericReponse } from '../responses';
import { DMPResolversMap } from './context';

export const permissionResolvers: DMPResolversMap = {
    Query: {
        getGrantedPermissions: async (parent, { studyId, projectId }: { studyId?: string, projectId?: string }, context) => {
            const requester = context.req.user;
            const matchClause: Record<string, unknown> = { users: requester.id };
            if (studyId)
                matchClause.studyId = studyId;
            if (projectId)
                matchClause.projectId = { $in: [projectId, null] };
            const aggregationPipeline = [
                { $match: matchClause }
                // { $group: { _id: requester.id, arrArrPrivileges: { $addToSet: '$permissions' } } },
                // { $project: { arrPrivileges: { $reduce: { input: '$arrArrPrivileges', initialValue: [], in: { $setUnion: ['$$this', '$$value'] } } } } }
            ];

            const grantedPermissions = {
                studies: await db.collections.roles_collection.aggregate(aggregationPipeline).toArray(),
                projects: await db.collections.roles_collection.aggregate(aggregationPipeline).toArray()
            };
            return grantedPermissions;
        }
    },
    StudyOrProjectUserRole: {
        users: async (role: IRole) => {
            const listOfUsers = role.users;
            return await (db.collections.users_collection.find({ id: { $in: listOfUsers } }, { projection: { _id: 0, password: 0, email: 0 } }).toArray());
        }
    },
    Mutation: {
        addRole: async (parent, args: { studyId: string, projectId?: string, roleName: string }, context) => {
            const requester = context.req.user;
            const { studyId, projectId, roleName } = args;

            /* check whether user has at least provided one id */
            if (studyId === undefined && projectId === undefined) {
                throw new GraphQLError('Please provide either study id or project id.', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
            }

            /* check the requester has privilege */
            const hasPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.role,
                atomicOperation.WRITE,
                requester,
                args.studyId,
                args.projectId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            /* check whether the target study or project exists */
            if (studyId && projectId) {  // if both study id and project id are provided then just make sure they belong to each other
                const result = await studyCore.findOneProject_throwErrorIfNotExist(projectId);
                if (result.studyId !== studyId) {
                    throw new GraphQLError('The project provided does not belong to the study provided', { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
                }
            } else if (studyId) {  // if only study id is provided
                await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            } else if (projectId) {
                await studyCore.findOneProject_throwErrorIfNotExist(projectId);
            }

            const result = await permissionCore.addRole({ createdBy: requester.id, studyId, projectId, roleName });
            return result;
        },
        editRole: async (parent, args: { roleId: string, name?: string, description?: string, userChanges?: { add: string[], remove: string[] }, permissionChanges }, context) => {
            const requester = context.req.user;
            const { roleId, name, permissionChanges, userChanges } = args;

            const role = await db.collections.roles_collection.findOne({ id: roleId, deleted: null });
            if (role === null) {
                throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* check the requester has privilege */
            const hasPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.role,
                atomicOperation.WRITE,
                requester,
                role.studyId,
                role.projectId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            /* check whether all the permissions are valid in terms of regular expressions */
            if (permissionChanges) {
                if (permissionChanges.data) {
                    if (permissionChanges.data.subjectIds) {
                        for (const subjectId of permissionChanges.data.subjectIds) {
                            checkReExpIsValid(subjectId);
                        }
                    }
                    if (permissionChanges.data.visitIds) {
                        for (const visitId of permissionChanges.data.visitIds) {
                            checkReExpIsValid(visitId);
                        }
                    }
                    if (permissionChanges.data.fieldIds) {
                        for (const fieldId of permissionChanges.data.fieldIds) {
                            checkReExpIsValid(fieldId);
                        }
                    }
                }
            }

            /* check whether all the users exists */
            if (userChanges) {
                const allRequestedUserChanges: string[] = [...userChanges.add, ...userChanges.remove];
                const testedUser: string[] = [];
                for (const each of allRequestedUserChanges) {
                    if (!testedUser.includes(each)) {
                        const user = await db.collections.users_collection.findOne({ id: each, deleted: null });
                        if (user === null) {
                            throw new GraphQLError(errorCodes.CLIENT_MALFORMED_INPUT);
                        } else {
                            testedUser.push(each);
                        }
                    }
                }
            }

            /* edit the role */
            const modifiedRole = await permissionCore.editRoleFromStudyOrProject(roleId, name, args.description, permissionChanges, userChanges);
            return modifiedRole;
        },
        removeRole: async (parent, args: { roleId: string }, context) => {
            const requester = context.req.user;
            const { roleId } = args;

            const role = await db.collections.roles_collection.findOne({ id: roleId, deleted: null });
            if (role === null) {
                throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryManagementPermission(
                IPermissionManagementOptions.role,
                atomicOperation.WRITE,
                requester,
                role.studyId,
                role.projectId
            );
            if (!hasPermission) { throw new GraphQLError(errorCodes.NO_PERMISSION_ERROR); }

            /* remove the role */
            await permissionCore.removeRole(roleId);
            return makeGenericReponse(roleId);
        }
    },
    Subscription: {}
};

function checkReExpIsValid(pattern: string) {
    try {
        new RegExp(pattern);
    } catch {
        throw new GraphQLError(`${pattern} is not a valid regular expression.`, { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
    }
}

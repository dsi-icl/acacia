import { ApolloError } from 'apollo-server-express';
import { db } from '../../database/database';
import { permissionCore } from '../core/permissionCore';
import { studyCore } from '../core/studyCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';
import { permissions, flattenObjectToArray, IUser, IRole } from 'itmat-commons';

export const permissionResolvers = {
    StudyOrProjectUserRole: {
        users: async (role: IRole): Promise<IUser[]> => {
            const listOfUsers = role.users;
            return await (db.collections!.users_collection.find<IUser>({ id: { $in: listOfUsers } }, { projection: { _id: 0, password: 0, email: 0 } }).toArray());
        }
    },
    Mutation: {
        addRoleToStudyOrProject: async (__unused__parent: Record<string, unknown>, args: { studyId: string, projectId?: string, roleName: string }, context: any): Promise<IRole> => {
            const requester: IUser = context.req.user;
            const { studyId, projectId, roleName } = args;

            /* check whether user has at least provided one id */
            if (studyId === undefined && projectId === undefined) {
                throw new ApolloError('Please provide either study id or project id.', errorCodes.CLIENT_MALFORMED_INPUT);
            }

            /* check the requester has privilege */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                args.projectId ? permissions.project_specific.roles.create_project_roles : permissions.dataset_specific.roles.create_dataset_roles,
                requester,
                args.studyId,
                args.projectId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            /* check whether the target study or project exists */
            if (studyId && projectId) {  // if both study id and project id are provided then just make sure they belong to each other
                const result = await studyCore.findOneProject_throwErrorIfNotExist(projectId);
                if (result.studyId !== studyId) {
                    throw new ApolloError('The project provided does not belong to the study provided', errorCodes.CLIENT_MALFORMED_INPUT);
                }
            } else if (studyId) {  // if only study id is provided
                await studyCore.findOneStudy_throwErrorIfNotExist(studyId);
            } else if (projectId) {
                await studyCore.findOneProject_throwErrorIfNotExist(projectId);
            }

            const result = await permissionCore.addRoleToStudyOrProject({ createdBy: requester.id, studyId: studyId!, projectId, roleName });
            return result;
        },
        editRole: async (__unused__parent: Record<string, unknown>, args: { roleId: string, name?: string, userChanges?: { add: string[], remove: string[] }, permissionChanges?: { add: string[], remove: string[] } }, context: any): Promise<IRole> => {
            const requester: IUser = context.req.user;
            const { roleId, name, permissionChanges, userChanges } = args;

            const role: IRole = await db.collections!.roles_collection.findOne({ id: roleId, deleted: null })!;
            if (role === null) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* check the requester has privilege */
            if (name) {
                const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                    role.projectId ? permissions.project_specific.roles.edit_project_role_name : permissions.dataset_specific.roles.edit_dataset_role_name,
                    requester,
                    role.studyId,
                    role.projectId
                );
                if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }
            }
            if (permissionChanges) {
                const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                    role.projectId ? permissions.project_specific.roles.edit_project_role_permissions : permissions.dataset_specific.roles.edit_dataset_role_permissions,
                    requester,
                    role.studyId,
                    role.projectId
                );
                if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }
            }
            if (userChanges) {
                const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                    role.projectId ? permissions.project_specific.roles.edit_project_role_users: permissions.dataset_specific.roles.edit_dataset_role_users,
                    requester,
                    role.studyId,
                    role.projectId
                );
                if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }
            }

            /* check whether all the permissions are valid */
            if (permissionChanges) {
                const allRequestedPermissionChanges: string[] = [...permissionChanges.add, ...permissionChanges.remove];

                const permittedPermissions: string[] = role.projectId ?
                    flattenObjectToArray(permissions.project_specific)
                    :
                    flattenObjectToArray(permissions.dataset_specific);
                for (const each of allRequestedPermissionChanges) {
                    if (!permittedPermissions.includes(each)) {
                        throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
                    }
                }
            }

            /* check whether all the users exists */
            if (userChanges) {
                const allRequestedUserChanges: string[] = [...userChanges.add, ...userChanges.remove];
                const testedUser: string[] = [];
                for (const each of allRequestedUserChanges) {
                    if (!testedUser.includes(each)) {
                        const user = await db.collections!.users_collection.findOne({ id: each, deleted: null });
                        if (user === null) {
                            throw new ApolloError(errorCodes.CLIENT_MALFORMED_INPUT);
                        } else {
                            testedUser.push(each);
                        }
                    }
                }
            }

            /* edit the role */
            const modifiedRole = await permissionCore.editRoleFromStudyOrProject(roleId, name, permissionChanges, userChanges);
            return modifiedRole;
        },
        removeRole: async (__unused__parent: Record<string, unknown>, args: { roleId: string }, context: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;
            const { roleId } = args;

            const role: IRole = await db.collections!.roles_collection.findOne({ id: roleId, deleted: null })!;
            if (role === null) {
                throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
            }

            /* check permission */
            const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
                role.projectId ? permissions.project_specific.roles.delete_project_roles : permissions.dataset_specific.roles.delete_dataset_roles,
                requester,
                role.studyId,
                role.projectId
            );
            if (!hasPermission) { throw new ApolloError(errorCodes.NO_PERMISSION_ERROR); }

            /* remove the role */
            await permissionCore.removeRole(roleId);
            return makeGenericReponse(roleId);
        }
    },
    Subscription: {}
};

import { ApolloError } from 'apollo-server-express';
import { IRole } from 'itmat-utils/dist/models/study';
import { makeGenericReponse, IGenericResponse } from '../responses';
import { permissionCore } from '../core/permissionCore';
import { errorCodes } from '../errors';
import { studyCore } from '../core/studyCore';
import { IUser } from 'itmat-utils/dist/models/user';

export const permissionResolvers = {
    Query: {},
    Mutation: {
        addRoleToStudyOrProject: async(parent: object, args: {studyId?: string, projectId?: string, roleName: string, permissions: string[]}, context: any, info: any): Promise<IRole> => {
            const requester: IUser = context.req.user;
            const { studyId, projectId, roleName, permissions } = args;
            /* check the requester has privilege */

            /* check whether all the permissions are valid */
            permissionCore.validatePermissionInput_throwErrorIfNot(permissions);

            /* check whether user has at least provided one id */
            if (studyId === undefined && projectId === undefined) {
                throw new ApolloError('Please provide either study id or project id.', errorCodes.CLIENT_MALFORMED_INPUT);
            }

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

            const result = await permissionCore.addRoleToStudyOrProject({ permissions, studyId, projectId, roleName });
            return result;
        },
        editRole: async(parent: object, args: {roleId: string, name: string, userChanges: { add: string[], remove: string[]}, permissionChanges: { add: string[], remove: string[]}}, context: any, info: any): Promise<IRole> => {
            const requester: IUser = context.req.user;
            const { roleId, name, permissionChanges, userChanges } = args;

            /* check permission */

            /* check whether all the permissions are valid */
            const allRequestedPermissionChanges: string[] = [...permissionChanges.add, ...permissionChanges.remove];
            permissionCore.validatePermissionInput_throwErrorIfNot(allRequestedPermissionChanges);

            /* check whether all the users exists */
            const allRequestedUserChanges: string[] = [...userChanges.add, ...permissionChanges.remove];
            // TO_OD

            /* edit the role */
            const modifiedRole = await permissionCore.editRoleFromStudyOrProject(roleId, permissionChanges, userChanges);
            return modifiedRole;
        },
        removeRoleFromStudyOrProject: async(parent: object, args: {roleId: string}, context: any, info: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;
            const { roleId } = args;

            /* check permission */

            /* remove the role */
            await permissionCore.removeRoleFromStudyOrProject(roleId);
            return makeGenericReponse(roleId);
        }
    },
    Subscription: {}
};
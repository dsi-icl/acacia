import { ApolloError } from 'apollo-server-express';
import { IRole } from 'itmat-utils/dist/models/study';
import { IUser } from 'itmat-utils/dist/models/user';
import { db } from '../../database/database';
import { permissionCore } from '../core/permissionCore';
import { studyCore } from '../core/studyCore';
import { errorCodes } from '../errors';
import { IGenericResponse, makeGenericReponse } from '../responses';


export const permissionResolvers = {
    Query: {
    },
    StudyOrProjectUserRole: {
        users: async (role: IRole): Promise<IUser[]> => {
            const listOfUsers = role.users;
            return await (db.collections!.users_collection.find({ id: { $in: listOfUsers } }, { projection: { _id: 0, password: 0 } }).toArray());
        }
    },
    Mutation: {
        addRoleToStudyOrProject: async (parent: object, args: { studyId?: string, projectId?: string, roleName: string }, context: any, info: any): Promise<IRole> => {
            const requester: IUser = context.req.user;
            const { studyId, projectId, roleName } = args;
            /* check the requester has privilege */


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

            const result = await permissionCore.addRoleToStudyOrProject({ studyId: studyId!, projectId, roleName });
            return result;
        },
        editRole: async (parent: object, args: { roleId: string, name?: string, userChanges?: { add: string[], remove: string[] }, permissionChanges?: { add: string[], remove: string[] } }, context: any, info: any): Promise<IRole> => {
            const requester: IUser = context.req.user;
            const { roleId, name, permissionChanges, userChanges } = args;

            /* check permission */

            /* check whether all the permissions are valid */  // TO_DO: permission changes are valid or invalid depending on project.
            // const allRequestedPermissionChanges: string[] = [...permissionChanges.add, ...permissionChanges.remove];
            // permissionCore.validatePermissionInput_throwErrorIfNot(allRequestedPermissionChanges);

            // /* check whether all the users exists */
            // const allRequestedUserChanges: string[] = [...userChanges.add, ...permissionChanges.remove];
            // TO_OD

            /* edit the role */
            const modifiedRole = await permissionCore.editRoleFromStudyOrProject(roleId, name, permissionChanges, userChanges);
            return modifiedRole;
        },
        removeRole: async (parent: object, args: { roleId: string }, context: any, info: any): Promise<IGenericResponse> => {
            const requester: IUser = context.req.user;
            const { roleId } = args;

            /* check permission */

            /* remove the role */
            await permissionCore.removeRole(roleId);
            return makeGenericReponse(roleId);
        }
    },
    Subscription: {}
};

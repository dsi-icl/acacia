import { IRole, IDataPermission, IManagementPermission } from '@itmat-broker/itmat-types';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { PermissionCore } from '@itmat-broker/itmat-cores';

const permissionCore = Object.freeze(new PermissionCore(db));

export const permissionResolvers: DMPResolversMap = {
    Query: {
        getGrantedPermissions: async (_parent, { studyId, projectId }: { studyId?: string, projectId?: string }, context) => {
            return await permissionCore.getGrantedPermissions(context.req.user, studyId, projectId);
        }
    },
    StudyOrProjectUserRole: {
        users: async (role: IRole) => {
            return permissionCore.getUsersOfRole(role);
        }
    },
    Mutation: {
        addRole: async (_parent, args: { studyId: string, projectId?: string, roleName: string }, context) => {
            return await permissionCore.addRole(context.req.user, args.studyId, args.projectId, args.roleName);
        },
        editRole: async (_parent, args: { roleId: string, name?: string, description?: string, userChanges?: { add: string[], remove: string[] }, permissionChanges?: { data?: IDataPermission, manage?: IManagementPermission } }, context) => {
            return await permissionCore.editRole(context.req.user, args.roleId, args.name, args.description, args.permissionChanges, args.userChanges);
        },
        removeRole: async (_parent, args: { roleId: string }, context) => {
            return await permissionCore.removeRole(context.req.user, args.roleId);
        }
    },
    Subscription: {}
};



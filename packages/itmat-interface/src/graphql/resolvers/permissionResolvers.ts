import { IRole } from '@itmat-broker/itmat-types';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { PermissionCore } from '@itmat-broker/itmat-cores';

const permissionCore = Object.freeze(new PermissionCore(db));

export const permissionResolvers: DMPResolversMap = {
    Query: {
        getGrantedPermissions: async (_parent, { studyId }: { studyId?: string }, context) => {
            return await permissionCore.getGrantedPermissions(context.req.user, studyId);
        }
    },
    StudyOrProjectUserRole: {
        users: async (role: IRole) => {
            return permissionCore.getUsersOfRole(role);
        }
    },
    Mutation: {
    },
    Subscription: {}
};



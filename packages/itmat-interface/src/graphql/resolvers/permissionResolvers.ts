import { IRole } from '@itmat-broker/itmat-types';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { TRPCPermissionCore } from '@itmat-broker/itmat-cores';

const permissionCore = new TRPCPermissionCore(db);

export const permissionResolvers: DMPResolversMap = {
    Query: {
        getGrantedPermissions: async (_parent, { studyId }: { studyId?: string }, context) => {
            return {
                studies: studyId ? await permissionCore.getRolesOfStudy(context.req.user, studyId) :
                    await permissionCore.getRolesOfUser(context.req.user, context.req.user?.id ?? ''),
                projects: []
            };
        }
    },
    StudyOrProjectUserRole: {
        users: async (role: IRole) => {
            return await permissionCore.getUsersOfRole(role.id);
        }
    },
    Mutation: {
    },
    Subscription: {}
};



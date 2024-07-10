import { IRole } from '@itmat-broker/itmat-types';
import { DMPResolversMap } from './context';
import { TRPCPermissionCore } from '@itmat-broker/itmat-cores';


export class PermissionResolvers {
    permissionCore: TRPCPermissionCore;
    constructor(permissionCore: TRPCPermissionCore) {
        this.permissionCore = permissionCore;
    }

    async getGrantedPermissions(_parent, { studyId }: { studyId?: string }, context) {
        return {
            studies: studyId ? await this.permissionCore.getRolesOfStudy(context.req.user, studyId) :
                await this.permissionCore.getRolesOfUser(context.req.user, context.req.user?.id ?? ''),
            projects: []
        };
    }

    async users(role: IRole) {
        return await this.permissionCore.getUsersOfRole(role.id);
    }

    getResolvers(): DMPResolversMap {
        return {
            Query: {
                getGrantedPermissions: this.getGrantedPermissions.bind(this)
            },
            StudyOrProjectUserRole: {
                users: this.users.bind(this)
            }
        };
    }

}



import { IRole } from '@itmat-broker/itmat-types';
import { DMPResolversMap } from './context';
import { PermissionCore } from '@itmat-broker/itmat-cores';


export class PermissionResolvers {
    permissionCore: PermissionCore;
    constructor(permissionCore: PermissionCore) {
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



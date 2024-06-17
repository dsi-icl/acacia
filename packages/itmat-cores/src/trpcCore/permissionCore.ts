import { IData, IField, IUserWithoutToken, enumDataAtomicPermissions, permissionString } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';

export class TRPCPermissionCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    /**
     * Get the roles of a user.
     *
     * @param user
     * @param studyId
     * @returns
     */
    public async getRolesOfUser(user: IUserWithoutToken, studyId?: string) {
        return studyId ? await this.db.collections.roles_collection.find({ 'studyId': studyId, 'users': user.id, 'life.deletedTime': null }).toArray() :
            await this.db.collections.roles_collection.find({ 'users': user.id, 'life.deletedTime': null }).toArray();
    }

    /**
     * Check if a user has a certain permission of a field or data.
     *
     * @param user - The user to check permission for.
     * @param studyId - The id of the study.
     * @param entry - The field or data to check permission for.
     * @param permission - The permission to check.
     *
     * @returns boolean
     */
    public async checkFieldOrDataPermission(user: IUserWithoutToken, studyId: string, entry: Partial<IField> | Partial<IData>, permission: enumDataAtomicPermissions) {
        const roles = await this.getRolesOfUser(user, studyId);
        for (const role of roles) {
            const dataPermissions = role.dataPermissions;
            for (const dataPermission of dataPermissions) {
                for (const field of dataPermission.fields) {
                    if (!(new RegExp(field).test(String(entry.fieldId)))) {
                        return false;
                    }
                }
                if ('value' in entry && dataPermission.dataProperties) {
                    if (entry.properties) {
                        for (const property in dataPermission.dataProperties) {
                            for (const prop of dataPermission.dataProperties[property]) {
                                if (!(new RegExp(prop).test(String(entry.properties[property])))) {
                                    return false;
                                }
                            }
                        }
                    }
                }
                if (!permissionString[permission].includes(dataPermission.permission)) {
                    return false;
                }
            }
        }
        return true;
    }
}
import { CoreError, IData, IDataPermission, IField, IRole, IUserWithoutToken, enumCoreErrors, enumDataAtomicPermissions, enumStudyRoles, enumUserTypes, permissionString } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { v4 as uuid } from 'uuid';
import { makeGenericResponse } from '../utils';

export class PermissionCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    /**
     * Get the roles of a user.
     *
     * @param roleId - The id of the role.
     *
     * @returns - IRole
     */
    public async getUsersOfRole(roleId: string) {
        const role = await this.db.collections.roles_collection.findOne({ 'id': roleId, 'life.deletedTime': null });
        if (!role) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }
        return await this.db.collections.users_collection.find({ id: { $in: role.users } }, { projection: { _id: 0, password: 0, otpSecret: 0 } }).toArray();
    }

    /**
     * Get the roles of a user.
     *
     * @param user
     * @param studyId
     *
     * @returns - IRole[]
     */
    public async getRolesOfUser(requester: IUserWithoutToken | undefined, userId: string, studyId?: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        // if studyId is provided, only admins, study managers and user him/herself can see the roles
        // if studyId is not provided, only admins and user him/herself can see the roles
        if (studyId) {
            return await this.db.collections.roles_collection.find({ 'studyId': studyId, 'users': userId, 'life.deletedTime': null }).toArray();
        } else {
            if (requester.type !== enumUserTypes.ADMIN && requester.id !== userId) {
                throw new CoreError(
                    enumCoreErrors.NO_PERMISSION_ERROR,
                    enumCoreErrors.NO_PERMISSION_ERROR
                );
            }
            return await this.db.collections.roles_collection.find({ 'users': userId, 'life.deletedTime': null }).toArray();
        }
    }

    /**
     * Get the roles of a study.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     *
     * @returns - IRole[]
     */
    public async getRolesOfStudy(requester: IUserWithoutToken | undefined, studyId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const roles = await this.getRolesOfUser(requester, requester.id, studyId);
        if (requester.type !== enumUserTypes.ADMIN && roles.every(role => role.studyRole !== enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        return await this.db.collections.roles_collection.find({ 'studyId': studyId, 'life.deletedTime': null }).toArray();
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
        const roles = await this.getRolesOfUser(user, user.id, studyId);
        let tag = true;
        for (const role of roles) {
            const dataPermissions = role.dataPermissions;
            for (const dataPermission of dataPermissions) {
                for (const field of dataPermission.fields) {
                    if (!(new RegExp(field).test(String(entry.fieldId)))) {
                        tag = false;
                    }
                }
                if ('value' in entry && dataPermission.dataProperties) {
                    if (entry.properties) {
                        for (const property in dataPermission.dataProperties) {
                            for (const prop of dataPermission.dataProperties[property]) {
                                if (!(new RegExp(prop).test(String(entry.properties[property])))) {
                                    tag = false;
                                }
                            }
                        }
                    }
                }
                if (!permissionString[permission].includes(dataPermission.permission)) {
                    tag = false;
                }
                if (tag) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Create a new role.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param name - The name of the role.
     * @param description - The description of the role.
     * @param dataPermissions - The data permissions of the role.
     * @param studyRole - The role of the study.
     * @param users - The users of the role.
     * @returns IRole
     */
    public async createStudyRole(requester: IUserWithoutToken | undefined, studyId: string, name: string, description?: string, dataPermissions?: IDataPermission[], studyRole?: enumStudyRoles, users?: string[]) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const roles = await this.getRolesOfUser(requester, requester.id, studyId);
        if (requester.type !== enumUserTypes.ADMIN && roles.every(role => role.studyRole !== enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const newRole: IRole = {
            id: uuid(),
            studyId: studyId,
            name: name,
            description: description,
            dataPermissions: dataPermissions ?? [{
                fields: [],
                dataProperties: {},
                includeUnVersioned: false,
                permission: 0
            }],
            studyRole: studyRole ?? enumStudyRoles.STUDY_USER,
            users: users ?? [],
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        };

        await this.db.collections.roles_collection.insertOne(newRole);
        return newRole;
    }

    /**
     * Edit a role.
     *
     * @param requester - The requester.
     * @param roleId - The id of the role.
     * @param name - The name of the role.
     * @param description - The description of the role.
     * @param dataPermissions - The data permissions of the role.
     * @param studyRole - The role of the study.
     * @param users - The users of the role.
     *
     * @returns IRole
     */
    public async editStudyRole(requester: IUserWithoutToken | undefined, roleId: string, name?: string, description?: string, dataPermissions?: IDataPermission[], studyRole?: enumStudyRoles, users?: string[]) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const role = await this.db.collections.roles_collection.findOne({ 'id': roleId, 'life.deletedTime': null });
        if (!role) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }
        const roles = await this.getRolesOfUser(requester, requester.id, role.studyId);
        if (requester.type !== enumUserTypes.ADMIN && roles.every(role => role.studyRole !== enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const res = await this.db.collections.roles_collection.findOneAndUpdate({ id: roleId }, {
            $set: {
                name: name ?? role.name,
                description: description ?? role.description,
                dataPermissions: dataPermissions ?? role.dataPermissions,
                studyRole: studyRole ?? role.studyRole,
                users: users ?? role.users
            }
        }, {
            returnDocument: 'after'
        });
        return res;
    }

    /**
     * Delete a role.
     *
     * @param requester - The requester.
     * @param roleId - The id of the role.
     * @returns - IGenericResponse
     */
    public async deleteStudyRole(requester: IUserWithoutToken | undefined, roleId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const role = await this.db.collections.roles_collection.findOne({ 'id': roleId, 'life.deletedTime': null });
        if (!role) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }
        const roles = await this.getRolesOfUser(requester, requester.id, role.studyId);
        if (requester.type !== enumUserTypes.ADMIN && roles.every(role => role.studyRole !== enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        await this.db.collections.roles_collection.findOneAndUpdate({ id: roleId }, {
            $set: {
                'life.deletedTime': Date.now(),
                'life.deletedUser': requester.id
            }
        });

        return makeGenericResponse(roleId, true, undefined, 'Role deleted successfully.');
    }
}
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
        const tags: boolean[] = [];
        for (const role of roles) {
            let tag = true;
            const dataPermissions = role.dataPermissions;
            for (const dataPermission of dataPermissions) {
                if (dataPermission.fields.every(field => !(new RegExp(field).test(String(entry.fieldId))))) {
                    tag = false;
                }
                if ('value' in entry && dataPermission.dataProperties) {
                    if (entry.properties) {
                        for (const property in dataPermission.dataProperties) {
                            if (dataPermission.dataProperties[property].every(prop => !(new RegExp(prop).test(String(entry.properties?.[property]))))) {
                                tag = false;
                            }
                        }
                    }
                }
                if (!permissionString[permission].includes(dataPermission.permission)) {
                    tag = false;
                }
            }
            tags.push(tag);
        }
        if (tags.every(tag => tag === false)) {
            return false;
        }
        return true;
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
     * Add a guest user to all public studies with read permissions.
     *
     * @param username - The username of the guest user to add.
     *
     * @returns IGenericResponse
     */
    public async addGuestUser(username: string) {

        if (!username) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                'Username is required to add a guest user.'
            );
        }

        const user = await this.db.collections.users_collection.findOne(
            { username: username },
            { projection: { _id: 0, password: 0, otpSecret: 0 } }
        ) as IUserWithoutToken | null;

        if (!user) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'User not found'
            );
        }
        if (user.type !== enumUserTypes.GUEST) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'User is not a guest user.'
            );
        }
        const publicStudies = await this.db.collections.studies_collection.find({
            'isPublic': true,
            'life.deletedTime': null
        }).toArray();
        if (publicStudies.length === 0) {
            return makeGenericResponse(user.id, true, undefined, 'No public studies found.');
        }
        // Get all roles with Guest permission in public studies
        // and add the user to those roles
        const studyIds = publicStudies.map(study => study.id);
        const guestRoles = await this.db.collections.roles_collection.find({
            'studyId': { $in: studyIds },
            'name': 'Guest',
            'dataPermissions': {
                $elemMatch: { permission: { $bitsAllSet: 4 } }
            },
            'life.deletedTime': null
        }).toArray();

        if (guestRoles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'No guest roles found for public studies.'
            );
        }
        // Update each guest role to include the user
        const updatePromises = guestRoles.map(async role =>
            this.db.collections.roles_collection.updateOne(
                { id: role.id, users: { $ne: user.id } },
                { $push: { users: user.id } }
            )
        );

        await Promise.all(updatePromises);

        return makeGenericResponse(user.id, true, undefined, `User added to ${updatePromises.length} public study roles`);
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

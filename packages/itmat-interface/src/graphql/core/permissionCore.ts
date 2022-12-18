import { ApolloError } from 'apollo-server-core';
import { IRole, IUser, userTypes } from '@itmat-broker/itmat-types';
import { BulkWriteResult } from 'mongodb';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';

interface ICreateRoleInput {
    studyId: string;
    projectId?: string;
    roleName: string;
    createdBy: string;
}

export class PermissionCore {
    public async getAllRolesOfStudyOrProject(studyId: string, projectId?: string): Promise<IRole[]> {
        return db.collections!.roles_collection.find({ studyId, projectId }).toArray();
    }

    public async userHasTheNeccessaryPermission(needAnyOneOfThesePermissions: string[], user: IUser, studyId: string, projectId?: string): Promise<boolean> {
        if (user === undefined) {
            return false;
        }

        /* if user is an admin then return true if admin privileges includes needed permissions */
        if (user.type === userTypes.ADMIN) {
            return true;
        }

        /* aggregationPipeline to return a list of the privileges the user has in this study / project */
        const aggregationPipeline = [
            { $match: { studyId, projectId: { $in: [projectId, null] }, users: user.id } }, // matches all the role documents where the study and project matches and has the user inside
            { $group: { _id: user.id, arrArrPrivileges: { $addToSet: '$permissions' } } },
            { $project: { arrPrivileges: { $reduce: { input: '$arrArrPrivileges', initialValue: [], in: { $setUnion: ['$$this', '$$value'] } } } } }
        ];
        const result = await db.collections!.roles_collection.aggregate(aggregationPipeline).toArray();
        if (result.length > 1) {
            throw new ApolloError('Internal error occurred when checking user privileges.', errorCodes.DATABASE_ERROR);
        }
        if (result.length === 0) {
            return false;
        }
        const hisPrivileges = result[0].arrPrivileges;   // example: [permissions.specific_project_data_access, permissions.specific_project_user_management]

        /* checking privileges */
        for (let i = 0, length = needAnyOneOfThesePermissions.length; i < length; i++) {
            if (hisPrivileges.includes(needAnyOneOfThesePermissions[i])) {
                return true;
            }
        }
        return false;
    }

    public async userHasTheNeccessaryManagementPermission(type: string, operation: string, user: IUser, studyId: string, projectId?: string): Promise<boolean> {
        if (user === undefined) {
            return false;
        }

        /* if user is an admin then return true if admin privileges includes needed permissions */
        if (user.type === userTypes.ADMIN) {
            return true;
        }
        const tag = `permissions.manage.${type}`;
        const roles = await db.collections!.roles_collection.aggregate([
            { $match: { studyId, projectId: { $in: [projectId, null] }, users: user.id, deleted: null } }, // matches all the role documents where the study and project matches and has the user inside
            { $match: { [tag]: operation } }
        ]).toArray();
        if (roles.length === 0) {
            return false;
        }
        return true;
    }

    public async userHasTheNeccessaryDataPermission(operation: string, user: IUser, studyId: string, projectId?: string): Promise<any> {
        if (user === undefined) {
            return false;
        }

        /* if user is an admin then return true if admin privileges includes needed permissions */
        if (user.type === userTypes.ADMIN) {
            return { hasVersioned: true };
        }

        const roles = await db.collections!.roles_collection.aggregate([
            { $match: { studyId, projectId: { $in: [projectId, null] }, users: user.id, deleted: null } }, // matches all the role documents where the study and project matches and has the user inside
            { $match: { 'permissions.data.operations': operation } }
        ]).toArray();
        let hasVersioned = false;
        const roleObj: any[] = [];
        for (const role of roles) {
            roleObj.push([{
                key: `role:${role.id}`,
                op: '=',
                parameter: true
            }]);
            if (role.permissions.data?.hasVersioned) {
                hasVersioned = hasVersioned || role.permissions.data.hasVersioned;
            }
        }
        if (Object.keys(roleObj).length === 0) {
            return false;
        }
        return { matchObj: roleObj, hasVersioned: hasVersioned };
    }

    public async removeRole(roleId: string): Promise<void> {
        const updateResult = await db.collections!.roles_collection.findOneAndUpdate({ id: roleId, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        if (updateResult.ok === 1) {
            return;
        } else {
            throw new ApolloError('Cannot delete role.', errorCodes.DATABASE_ERROR);
        }
    }

    public async removeRoleFromStudyOrProject({ studyId, projectId }: { studyId: string, projectId?: string } | { studyId?: string, projectId: string }): Promise<void> {
        if (studyId === undefined && projectId === undefined) {
            throw new ApolloError('Neither studyId nor projectId is provided');
        }
        let queryObj = {};
        if (studyId !== undefined && projectId !== undefined) {
            queryObj = { studyId, projectId, deleted: null };
        } else if (studyId !== undefined) {
            queryObj = { studyId, deleted: null };
        } else if (projectId !== undefined) {
            queryObj = { projectId, deleted: null };
        }
        const updateResult = await db.collections!.roles_collection.updateMany(queryObj, { $set: { deleted: new Date().valueOf() } });
        if (updateResult.acknowledged) {
            return;
        } else {
            throw new ApolloError('Cannot delete role(s).', errorCodes.DATABASE_ERROR);
        }
    }

    public async editRoleFromStudyOrProject(roleId: string, name?: string, permissionChanges?: any, userChanges?: { add: string[], remove: string[] }): Promise<IRole> {
        if (permissionChanges === undefined) { permissionChanges = { data: { subjectIds: [], visitIds: [], fieldIds: [], hasVersioned: false } }; }
        if (userChanges === undefined) { userChanges = { add: [], remove: [] }; }

        const bulkop = db.collections!.roles_collection.initializeUnorderedBulkOp();
        bulkop.find({ id: roleId, deleted: null }).updateOne({ $set: { permissions: permissionChanges }, $addToSet: { users: { $each: userChanges.add } } });
        bulkop.find({ id: roleId, deleted: null }).updateOne({ $set: { permissions: permissionChanges }, $pullAll: { users: userChanges.remove } });
        if (name) {
            bulkop.find({ id: roleId, deleted: null }).updateOne({ $set: { name } });
        }
        const result: BulkWriteResult = await bulkop.execute();
        const resultingRole = await db.collections!.roles_collection.findOne({ id: roleId, deleted: null });
        if (!resultingRole) {
            throw new ApolloError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, 'Role does not exist');
        }
        // update the data and field records
        const dataBulkOp = db.collections!.data_collection.initializeUnorderedBulkOp();
        const filters: any = {
            subjectIds: permissionChanges.data?.subjectIds || [],
            visitIds: permissionChanges.data?.visitIds || [],
            fieldIds: permissionChanges.data?.fieldIds || []
        };
        const dataTag = `metadata.${'role:'.concat(roleId)}`;
        dataBulkOp.find({
            m_studyId: resultingRole.studyId,
            m_versionId: { $exists: true, $ne: null },
            m_subjectId: { $in: filters.subjectIds.map((el: string) => new RegExp(el)) },
            m_visitId: { $in: filters.visitIds.map((el: string) => new RegExp(el)) },
            m_fieldId: { $in: filters.fieldIds.map((el: string) => new RegExp(el)) }
        }).update({
            $set: { [dataTag]: true }
        });
        dataBulkOp.find({
            m_studyId: resultingRole.studyId,
            m_versionId: { $exists: true, $ne: null },
            $or: [
                { m_subjectId: { $nin: filters.subjectIds.map((el: string) => new RegExp(el)) } },
                { m_visitId: { $nin: filters.visitIds.map((el: string) => new RegExp(el)) } },
                { m_fieldId: { $nin: filters.fieldIds.map((el: string) => new RegExp(el)) } }
            ]
        }).update({
            $set: { [dataTag]: false }
        });
        const fieldBulkOp = db.collections!.field_dictionary_collection.initializeUnorderedBulkOp();
        const fieldIds = permissionChanges.data?.fieldIds || [];
        const fieldTag = `metadata.${'role:'.concat(roleId)}`;
        fieldBulkOp.find({
            studyId: resultingRole.studyId,
            dataVersion: { $exists: true, $ne: null },
            fieldId: { $in: fieldIds.map((el: string) => new RegExp(el)) }
        }).update({
            $set: { [fieldTag]: true }
        });
        fieldBulkOp.find({
            studyId: resultingRole.studyId,
            dataVersion: { $exists: true, $ne: null },
            fieldId: { $nin: fieldIds.map((el: string) => new RegExp(el)) }
        }).update({
            $set: { [fieldTag]: false }
        });
        await dataBulkOp.execute();
        await fieldBulkOp.execute();
        if (result.ok === 1 && resultingRole) {
            return resultingRole;
        } else {
            throw new ApolloError('Cannot edit role.', errorCodes.DATABASE_ERROR);
        }
    }

    public async addRole(opt: ICreateRoleInput): Promise<IRole> {
        /* add user role */
        const role: IRole = {
            id: uuid(),
            name: opt.roleName,
            permissions: {
                data: {
                    subjectIds: [],
                    visitIds: [],
                    fieldIds: [],
                    hasVersioned: false
                },
                manage: {
                    own: [],
                    role: []
                }
            },
            users: [],
            studyId: opt.studyId,
            projectId: opt.projectId,
            createdBy: opt.createdBy,
            deleted: null
        };
        const updateResult = await db.collections!.roles_collection.insertOne(role);
        if (updateResult.acknowledged) {
            return role;
        } else {
            throw new ApolloError('Cannot create role.', errorCodes.DATABASE_ERROR);
        }
    }
}

export const permissionCore = new PermissionCore();

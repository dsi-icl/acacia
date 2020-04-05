import { ApolloError } from 'apollo-server-core';
import { permissions } from '@itmat/commons';
import { IRole } from '@itmat/commons';
import { IUser, userTypes } from '@itmat/commons';
import { BulkWriteResult } from 'mongodb';
import { v4 as uuid } from 'uuid';
import { db } from '../../database/database';
import { errorCodes } from '../errors';

interface ICreateRoleInput {
    studyId: string;
    projectId?: string;
    roleName: string;
}

// interface IUserToRoleInput {
//     roleId: string;
//     userId: string;
// }

export class PermissionCore {
    public validatePermissionInput_throwErrorIfNot(inputPermissions: string[]): void {
        const allPermissions = Object.entries(permissions).reduce((a: string[], e: any) => a.concat(Object.values(e[1])), []);
        for (const each of inputPermissions) {
            if (!allPermissions.includes(each)) {
                throw new ApolloError(`"${each}" is not a valid permission.`, errorCodes.CLIENT_MALFORMED_INPUT);
            }
        }
    }

    public async getAllRolesOfStudyOrProject(studyId: string, projectId?: string): Promise<IRole[]> {
        return db.collections!.roles_collection.find({ studyId, projectId }).toArray();
    }

    public async userHasTheNeccessaryPermission(needOneOfThesePermissions: string[], user: IUser, studyId: string, projectId?: string): Promise<boolean> {
        if (user === undefined) {
            return false;
        }
        /* if user is an admin then return true if admin privileges includes needed permissions */
        if (user.type === userTypes.ADMIN) {
            return true;
        }

        /* aggregationPipeline to return a list of the privileges the user has in this study / project */
        const aggregationPipeline = [
            { $match: { studyId, projectId, users: user.id } }, // matches all the role documents where the study and project matches and has the user inside
            { $group: { _id: user.id, arrArrPrivileges: { $addToSet: '$permissions' } } },
            { $project: { arrPrivileges: { $reduce: { input: '$arrArrPrivileges', initialValue: [], in: { $setUnion: ['$$this', '$$value'] } } } } },
        ];
        const result: { _id: string; arrPrivileges: string[] }[] = await db.collections!.roles_collection.aggregate(aggregationPipeline).toArray();
        if (result.length !== 1) {
            throw new ApolloError('Internal error occurred when checking user privileges.', errorCodes.DATABASE_ERROR);
        }
        const hisPrivileges = result[0].arrPrivileges; // example: [permissions.specific_project_data_access, permissions.specific_project_user_management]

        /* checking privileges */
        for (let i = 0, { length } = needOneOfThesePermissions; i < length; i++) {
            if (hisPrivileges.includes(needOneOfThesePermissions[i])) {
                return true;
            }
        }
        return false;
    }

    public async removeRole(roleId: string): Promise<void> {
        const updateResult = await db.collections!.roles_collection.findOneAndUpdate({ id: roleId, deleted: null }, { $set: { deleted: new Date().valueOf() } });
        if (updateResult.ok === 1) {
            // TODO
        } else {
            throw new ApolloError('Cannot delete role.', errorCodes.DATABASE_ERROR);
        }
    }

    public async removeRoleFromStudyOrProject({ studyId, projectId }: { studyId: string; projectId?: string } | { studyId?: string; projectId: string }): Promise<void> {
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
        if (updateResult.result.ok === 1) {
            // TODO
        } else {
            throw new ApolloError('Cannot delete role(s).', errorCodes.DATABASE_ERROR);
        }
    }

    public async editRoleFromStudyOrProject(roleId: string, name?: string, permissionChanges?: { add: string[]; remove: string[] }, userChanges?: { add: string[]; remove: string[] }): Promise<IRole> {
        if (permissionChanges === undefined) { permissionChanges = { add: [], remove: [] }; }
        if (userChanges === undefined) { userChanges = { add: [], remove: [] }; }

        // const updateObj: any = {
        //     $addToSet: { permissions: { $each: permissionChanges.add }, users: { $each: userChanges.add } },
        //     $pullAll: { permissions: permissionChanges.remove, users: userChanges.remove }
        // };
        // if (name) {
        //     updateObj.$set = { name };
        // }

        const bulkop = db.collections!.roles_collection.initializeUnorderedBulkOp();
        bulkop.find({ id: roleId, deleted: null }).updateOne({ $addToSet: { permissions: { $each: permissionChanges.add }, users: { $each: userChanges.add } } });
        bulkop.find({ id: roleId, deleted: null }).updateOne({ $pullAll: { permissions: permissionChanges.remove, users: userChanges.remove } });
        if (name) {
            bulkop.find({ id: roleId, deleted: null }).updateOne({ $set: { name } });
        }
        const result: BulkWriteResult = await bulkop.execute();
        if (result.ok === 1) {
            return await db.collections!.roles_collection.findOne({ id: roleId, deleted: null })!;
        }
        throw new ApolloError('Cannot edit role.', errorCodes.DATABASE_ERROR);


        // const updateResult = await db.collections!.roles_collection.findOneAndUpdate({ id: roleId, deleted: null }, updateObj, { returnOriginal: false });
        // if (updateResult.ok === 1) {
        //     return updateResult.value;
        // } else {
        // }
    }

    public async addRoleToStudyOrProject(opt: ICreateRoleInput): Promise<IRole> {
        // /* check that all the permissions really exist */
        // const possiblePermissions = Object.values(permissions);
        // opt.permissions.forEach(el => {
        //     if (!possiblePermissions.includes(el)) {
        //         throw new ApolloError(`"${el}" is not in the possible permissions: [${JSON.stringify(possiblePermissions)}]`, errorCodes.CLIENT_MALFORMED_INPUT);
        //     }
        // });

        // /* check that study or project exists and the role does not already exist */
        // const queryObj = opt.projectId === undefined ? { study: opt.studyId, deleted: null } : { study: opt.studyId, project: opt.projectId, deleted: null };
        // const searchResult: IProject | IStudy = await targetCollection.findOne(queryObj)!;
        // const errorTarget = opt.project === undefined ? `Project "${opt.project}" of study "${opt.study}"` : `Study "${opt.study}"`
        // if (searchResult === null || searchResult === undefined) {
        //     throw new ApolloError(`${errorTarget} does not exist.`, errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        // }
        // if (searchResult.roles.filter(el => el.name === opt.roleName).length !== 0) {
        //     throw new ApolloError(`Role "${opt.roleName}" already exists on ${errorTarget}.`, errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        // }

        /* add user role */
        const role: IRole = {
            id: uuid(),
            name: opt.roleName,
            permissions: [],
            users: [],
            studyId: opt.studyId,
            projectId: opt.projectId,
            deleted: null,
        };
        const updateResult = await db.collections!.roles_collection.insertOne(role);
        if (updateResult.result.ok === 1 && updateResult.insertedCount === 1) {
            return role;
        }
        throw new ApolloError(`Cannot create role. nInserted: ${updateResult.insertedCount}`, errorCodes.DATABASE_ERROR);
    }
}

export const permissionCore = new PermissionCore();

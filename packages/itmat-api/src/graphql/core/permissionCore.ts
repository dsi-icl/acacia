import mongodb from 'mongodb';
import { db } from '../../database/database';
import { permissions } from 'itmat-utils';
import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy, IRole } from 'itmat-utils/dist/models/study';
import { errorCodes } from '../errors';
import uuidv4 from 'uuid/v4';
import { IUser, userTypes } from 'itmat-utils/dist/models/user';

interface ICreateRoleInput {
    studyId: string,
    projectId?: string,
    roleName: string,
    permissions: string[]
}

interface IUserToRoleInput {
    roleId: string,
    userId: string
}

export class PermissionCore {
    private readonly hardCodedAdminPrivileges: string[];
    constructor() {
        this.hardCodedAdminPrivileges = [...Object.values(permissions)]; // admin has all privileges 
    }

    validatePermissionInput_throwErrorIfNot(inputPermissions: string[]): void {
        const allPermissions = Object.values(permissions);
        for (let each of inputPermissions) {
            if (!allPermissions.includes(each)) {
                throw new ApolloError(`"${each}" is not a valid permission.`, errorCodes.CLIENT_MALFORMED_INPUT);
            }
        }
        return;
    }

    async getAllRolesOfStudyOrProject(studyId: string, projectId?: string): Promise<IRole[]> {
        return db.collections!.roles_collection.find({ studyId, projectId }).toArray();
    }

    async userHasTheNeccessaryPermission(needOneOfThesePermissions: string[], user: IUser, study: string, project?: string): Promise<boolean> {
        /* if user is an admin then return true if admin privileges includes needed permissions */
        if (user.type === userTypes.ADMIN) {
            for (let i = 0, length = needOneOfThesePermissions.length; i < length; i++) {
                if (this.hardCodedAdminPrivileges.includes(needOneOfThesePermissions[i])) {
                    return true;
                }
            }
        }

        /* aggregationPipeline to return a list of the privileges the user has in this study / project */
        const aggregationPipeline = [
            { $match: { study, project, users: user.id } }, // matches all the role documents where the study and project matches and has the user inside
            { $group: {  _id: user.id, arrArrPrivileges: { $addToSet: '$permissions' } }  },
            { $project: { arrPrivileges: { $reduce: { input: '$arrArrPrivileges', initialValue: [], in: { $setUnion: [ '$$this', '$$value' ] }  } } } }
        ];
        const result: { _id: string, arrPrivileges: string[] }[] = await db.collections!.roles_collection.aggregate(aggregationPipeline).toArray();
        if (result.length !== 1) {
            throw new ApolloError(`Internal error occurred when checking user privileges.`, errorCodes.DATABASE_ERROR);
        }
        const hisPrivileges = result[0].arrPrivileges;

        /* checking privileges */
        for (let i = 0, length = needOneOfThesePermissions.length; i < length; i++) {
            if (hisPrivileges.includes(needOneOfThesePermissions[i])) {
                return true;
            }
        }
        return false;
    }

    async removeRole(roleId: string): Promise<void> {
        const updateResult = await db.collections!.roles_collection.findOneAndUpdate({ id: roleId, deleted: false }, { $set: { deleted: true } });
        if (updateResult.ok === 1) {
            return;
        } else {
            throw new ApolloError(`Cannot delete role.`, errorCodes.DATABASE_ERROR);
        }
    }

    async removeRoleFromStudyOrProject({ studyId, projectId }: { studyId: string, projectId?: string } | { studyId?: string, projectId: string } ): Promise<void> {
        if (studyId === undefined && projectId === undefined) {
            throw new ApolloError('Neither studyId nor projectId is provided');
        }
        let queryObj = {};
        if (studyId !== undefined && projectId !== undefined) {
            queryObj = { studyId, projectId, deleted: false };
        } else if (studyId !== undefined) {
            queryObj = { studyId, deleted: false };
        } else if (projectId !== undefined) {
            queryObj = { projectId, deleted: false };
        }
        const updateResult = await db.collections!.roles_collection.updateMany(queryObj, { $set: { deleted: true } });
        if (updateResult.result.ok === 1) {
            return;
        } else {
            throw new ApolloError(`Cannot delete role(s).`, errorCodes.DATABASE_ERROR);
        }
    }

    async editRoleFromStudyOrProject(roleId: string, permissionChanges: { add: string[], remove: string[] }, userChanges: { add: string[], remove: string[] }): Promise<IRole> {
        const updateResult = await db.collections!.roles_collection.findOneAndUpdate({ id: roleId, deleted: false }, {
            $addToSet: { permissions: { $each: permissionChanges.add }, users: { $each: userChanges.add } },
            $pullAll: { permissions: permissionChanges.remove, users: userChanges.remove }
        });
        if (updateResult.ok === 1) {
            return updateResult.value;
        } else {
            throw new ApolloError(`Cannot edit role.`, errorCodes.DATABASE_ERROR);
        }
    }

    async addRoleToStudyOrProject(opt: ICreateRoleInput): Promise<IRole> {
        // /* check that all the permissions really exist */
        // const possiblePermissions = Object.values(permissions);
        // opt.permissions.forEach(el => {
        //     if (!possiblePermissions.includes(el)) {
        //         throw new ApolloError(`"${el}" is not in the possible permissions: [${JSON.stringify(possiblePermissions)}]`, errorCodes.CLIENT_MALFORMED_INPUT);
        //     }
        // });

        // /* check that study or project exists and the role does not already exist */
        const queryObj = opt.projectId === undefined ? { study: opt.studyId, deleted: false } : { study: opt.studyId, project: opt.projectId, deleted: false };
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
            id: uuidv4(),
            name: opt.roleName,
            permissions: opt.permissions,
            users: [],
            studyId: opt.studyId,
            projectId: opt.projectId,
            deleted: false
        };
        const updateResult = await db.collections!.roles_collection.insertOne(role);
        if (updateResult.result.ok === 1 && updateResult.insertedCount === 1) {
            return role;
        } else {
            throw new ApolloError(`Cannot create role. nInserted: ${updateResult.insertedCount}`, errorCodes.DATABASE_ERROR);
        }
    }

    async addUserToRole(opt: IUserToRoleInput): Promise<IRole> {
        const { roleId, userId } = opt;
        const updateResult = await db.collections!.roles_collection.findOneAndUpdate({ id: roleId, deleted: false }, { $addToSet: { users: userId } });
        if (updateResult.ok === 1) {
            return updateResult.value;
        } else {
            throw new ApolloError(`Cannot update role. ${updateResult.lastErrorObject}`, errorCodes.DATABASE_ERROR);
        }
    }

    async removeUserFromRole(opt: IUserToRoleInput): Promise<IRole> {
        const { roleId, userId } = opt;
        const updateResult = await db.collections!.roles_collection.findOneAndUpdate({ id: roleId, deleted: false }, { $pull: { users: userId } });
        if (updateResult.ok === 1) {
            return updateResult.value;
        } else {
            throw new ApolloError(`Cannot update role. ${updateResult.lastErrorObject}`, errorCodes.DATABASE_ERROR);
        }
    }
}

export const permissionCore = new PermissionCore();
import { GraphQLError } from 'graphql';
import { IData, IField, IRole, IUserWithoutToken, enumDataAtomicPermissions, enumUserTypes, permissionString } from '@itmat-broker/itmat-types';
import { Document, Filter } from 'mongodb';
import { DBType } from '../database/database';
import { errorCodes } from '../utils/errors';
import { CreateFieldInput } from './studyCore';

export interface ICombinedPermissions {
    subjectIds: string[],
    visitIds: string[],
    fieldIds: string[]
}

export interface QueryMatcher {
    key: string,
    op: string,
    parameter: number | string | boolean
}

export class PermissionCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    public async getGrantedPermissions(requester: IUserWithoutToken | undefined, studyId?: string) {
        if (!requester) {
            throw new GraphQLError(errorCodes.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY);
        }
        const matchClause: Filter<IRole> = { users: requester.id };
        if (studyId)
            matchClause.studyId = studyId;
        const aggregationPipeline = [
            { $match: matchClause }
            // { $group: { _id: requester.id, arrArrPrivileges: { $addToSet: '$permissions' } } },
            // { $project: { arrPrivileges: { $reduce: { input: '$arrArrPrivileges', initialValue: [], in: { $setUnion: ['$$this', '$$value'] } } } } }
        ];

        const grantedPermissions = {
            studies: await this.db.collections.roles_collection.aggregate(aggregationPipeline).toArray(),
            projects: await this.db.collections.roles_collection.aggregate(aggregationPipeline).toArray()
        };
        return grantedPermissions;
    }

    public async getUsersOfRole(role: IRole) {
        const listOfUsers = role.users;
        return await (this.db.collections.users_collection.find({ id: { $in: listOfUsers } }, { projection: { _id: 0, password: 0, email: 0 } }).toArray());

    }

    public async getAllRolesOfStudyOrProject(studyId: string): Promise<IRole[]> {
        return await this.db.collections.roles_collection.find({ studyId }).toArray();
    }

    public async userHasTheNeccessaryManagementPermission(type: string, operation: string, user: IUserWithoutToken, studyId: string, projectId?: string) {
        if (user === undefined) {
            return false;
        }

        /* if user is an admin then return true if admin privileges includes needed permissions */
        if (user.type === enumUserTypes.ADMIN) {
            return true;
        }
        const tag = `permissions.manage.${type}`;
        const roles = await this.db.collections.roles_collection.aggregate([
            { $match: { studyId, projectId: { $in: [projectId, null] }, users: user.id, deleted: null } }, // matches all the role documents where the study and project matches and has the user inside
            { $match: { [tag]: operation } }
        ]).toArray();
        if (roles.length === 0) {
            return false;
        }
        return true;
    }

    // TODO: check data is valid based on field schema
    public checkDataValid() {
        return false;
    }

    public checkDataPermission(roles: IRole[], dataEntry: IData, permission: enumDataAtomicPermissions) {
        for (const role of roles) {
            for (const dataPermission of role.dataPermissions) {
                if (
                    dataPermission.fields.some(field => new RegExp(field).test(dataEntry.fieldId))
                    && Object.keys(dataPermission.dataProperties).every(property => dataPermission.dataProperties[property].some(prop => new RegExp(prop).test(String(dataEntry.properties[property])))
                        && dataPermission.includeUnVersioned
                        && permissionString[permission].includes(dataPermission.permission)
                    )) {
                    return true;
                }
            }
        }
        return false;
    }

    public checkFieldPermission(roles: IRole[], fieldEntry: Partial<IField> | Partial<CreateFieldInput>, permission: enumDataAtomicPermissions) {
        for (const role of roles) {
            for (const dataPermission of role.dataPermissions) {
                if (
                    dataPermission.fields.some(field => new RegExp(field).test(fieldEntry.fieldId ?? ''))
                    && permissionString[permission].includes(dataPermission.permission)
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    public async getRolesOfUser(user: IUserWithoutToken, studyId: string) {
        return await this.db.collections.roles_collection.find({ 'studyId': studyId, 'users': user.id, 'life.deletedTime': null }).toArray();
    }

    public checkReExpIsValid(pattern: string) {
        try {
            new RegExp(pattern);
        } catch {
            throw new GraphQLError(`${pattern} is not a valid regular expression.`, { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
        }
    }
}

export function translateCohort(cohort) {
    const queries: Document[] = [];
    cohort.forEach(function (select) {
        const match = {
            m_fieldId: select.field
        };
        switch (select.op) {
            case '=':
                // select.value must be an array
                match['value'] = { $in: [select.value] };
                break;
            case '!=':
                // select.value must be an array
                match['value'] = { $nin: [select.value] };
                break;
            case '<':
                // select.value must be a float
                match['value'] = { $lt: parseFloat(select.value) };
                break;
            case '>':
                // select.value must be a float
                match['value'] = { $gt: parseFloat(select.value) };
                break;
            case 'derived': {
                // equation must only have + - * /
                const derivedOperation = select.value.split(' ');
                if (derivedOperation[0] === '=') {
                    match['value'] = { $eq: parseFloat(select.value) };
                }
                if (derivedOperation[0] === '>') {
                    match['value'] = { $gt: parseFloat(select.value) };
                }
                if (derivedOperation[0] === '<') {
                    match['value'] = { $lt: parseFloat(select.value) };
                }
                break;
            }
            case 'exists':
                // We check if the field exists. This is to be used for checking if a patient
                // has an image
                match['value'] = { $exists: true };
                break;
            case 'count': {
                // counts can only be positive. NB: > and < are inclusive e.g. < is <=
                const countOperation = select.value.split(' ');
                const countfield = select.field + '.count';
                if (countOperation[0] === '=') {
                    match[countfield] = { $eq: parseInt(countOperation[1], 10) };
                }
                if (countOperation[0] === '>') {
                    match[countfield] = { $gt: parseInt(countOperation[1], 10) };
                }
                if (countOperation[0] === '<') {
                    match[countfield] = { $lt: parseInt(countOperation[1], 10) };
                }
                break;
            }
            default:
                break;
        }
        queries.push(match);
    }
    );
    return queries;
}

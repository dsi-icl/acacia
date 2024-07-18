import { IBase } from './base';

// we use three bit to denote read, write and delele, saved as number

// we use mongodb which is a collection of json documents
// this permission accepts json input and decide the permissions
// we provide three permissions: read, write and delete
export interface IDocumentLevelPermission {
    reads: string[];
    writes: string[];
    deletes: string[];
}

// study assistant can have full control of user management
// study manager in addition can manage the study data and study itself, e.g., editing study metadata
// study user only have access to data filtered by dataPermissions
export enum enumStudyRoles {
    STUDY_MANAGER = 'STUDY_MANAGER',
    STUDY_ASSISTANT = 'STUDY_ASSISTANT',
    STUDY_USER = 'STUDY_USER'
}

export interface IDataPermission {
    fields: string[]; // regular expression
    dataProperties: {
        [property: string]: string[] // regular expression
    },
    includeUnVersioned: boolean,
    permission: number
}

export interface IRole extends IBase {
    studyId: string;
    name: string;
    description?: string;

    // data permissions for studyId
    dataPermissions: IDataPermission[]; // or
    studyRole: enumStudyRoles;
    users: string[];
}

// read - write - delete
export const permissionString: Record<string, number[]> = {
    READ: [4, 5, 6, 7],
    WRITE: [6, 7],
    DELETE: [7]
};

export enum enumDataAtomicPermissions {
    READ = 'READ',
    WRITE = 'WRITE',
    DELETE = 'DELETE'
}
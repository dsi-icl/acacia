import { IBase } from './base';

/**
 * The node of the drive. It can be a folder or a file.
 */
export interface IDrive extends IBase {
    managerId: string;
    path: string[];
    restricted: boolean; // whether to allow delete on this node. User own folders are protected.
    name: string; // folder name or file name
    description?: string;
    fileId: string | null; // null for folder
    type: enumDriveNodeTypes;
    parent: string | null; // null for root node
    children: string[]; // ids of the file nodes
    sharedUsers: IDrivePermission[]; // ids of shared users
}

// this permission is different form data permissions
export interface IDrivePermission {
    iid: string; // userId or userGroupId
    read: boolean;
    write: boolean;
    delete: boolean;
}

export enum enumDriveNodeTypes {
    FOLDER = 'FOLDER',
    FILE = 'FILE'
}

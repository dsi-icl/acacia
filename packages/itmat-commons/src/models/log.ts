import { userTypes } from './user';

export interface ILogEntry {
    id: string,
    requesterId: string,
    requesterName: string,
    requesterType: userTypes,
    action: LOG_ACTION,
    actionData: any,
    time: number
}

export enum LOG_TYPE {
    USER = 'USER',
    PROJECT = 'PROJECT',
    STUDY = 'STUDY',
    FILE = 'FILE'
}

export enum LOG_ACTION {
    // USER
    CREATE_USER = 'CREATE_USER',
    DELETE_USER = 'DELETE_USER',
    // PROJECT

    // STUDY

    // FILE
    UPLOAD_FILE = 'UPLOAD_FILE',
    DOWNLOAD_FILE = 'DOWNLOAD_FILE',
    DELETE_FILE = 'DELETE_FILE'
}

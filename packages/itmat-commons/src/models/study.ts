import { IUser } from './user';

export enum studyType {
    SENSOR = 'SENSOR',
    CLINICAL = 'CLINICAL',
    ANY = 'ANY'
}

export interface IStudy {
    id: string;
    name: string;
    createdBy: string;
    lastModified: number;
    deleted: number | null;
    currentDataVersion: number; // index; dataVersions[currentDataVersion] gives current version; // -1 if no data
    dataVersions: IStudyDataVersion[];
    description: string;
    type: studyType;
    ontologyTree?: IOntologyField[];
}

export interface IOntologyField {
    fieldId: string;
    path: string;
}

export interface IStudyDataVersion {
    id: string; // uuid
    contentId: string; // same contentId = same data
    version: string;
    tag?: string;
    updateDate: string;
}


export interface IRole {
    id: string;
    projectId?: string;
    studyId: string;
    name: string;
    permissions: string[];
    users: IUser[];
    createdBy: string;
    deleted: number | null;
}

export interface IProject {
    id: string;
    studyId: string;
    createdBy: string;
    name: string;
    patientMapping: { [originalId: string]: string };
    approvedFields: string[];
    approvedFiles: string[];
    lastModified: number;
    deleted: number | null;
    dataVersion: string | null;
}

export interface IDataClip {
    fieldId: string,
    value: string,
    subjectId: string,
    visitId: string
}

export enum DATA_CLIP_ERROR_TYPE {
    ACTION_ON_NON_EXISTENT_ENTRY = 'ACTION_ON_NON_EXISTENT_ENTRY',
    MALFORMED_INPUT = 'MALFORMED_INPUT'
}

export interface IDataClipError {
    code: DATA_CLIP_ERROR_TYPE
    description?: string
}

export interface ISubjectDataRecordSummary {
    subjectId: string,
    visitId?: string,
    errorFields: string[]
}

import { IBase } from './base';
import { IUser } from './user';
import { FileUpload } from 'graphql-upload-minimal';

export enum studyType {
    SENSOR = 'SENSOR',
    CLINICAL = 'CLINICAL',
    ANY = 'ANY'
}

export interface IStudy extends IBase {
    name: string;
    currentDataVersion: number; // index; dataVersions[currentDataVersion] gives current version; // -1 if no data
    dataVersions: IStudyDataVersion[];
    description?: string;
    profile?: string;
    ontologyTrees?: IOntologyTree[];
}

export interface IStudyDataVersion extends IBase {
    id: string;
    version: string;
    tag?: string;
}

export enum atomicOperation {
    READ = 'READ',
    WRITE = 'WRITE'
}

export enum IPermissionManagementOptions {
    own = 'own',
    role = 'role',
    job = 'job',
    query = 'query',
    ontologyTrees = 'ontologyTrees'
}

type RoleBaseFilter = {
    field: string;
    op: string;
    value: string | number;
};

export interface IDataPermission {
    subjectIds?: string[];
    visitIds?: string[];
    fieldIds?: string[];
    uploaders?: string[]; // only works for downloading data; for file data, it will check IFile instead of data clip
    hasVersioned?: boolean;
    operations?: atomicOperation[];
    filters?: RoleBaseFilter[]
}

export interface IManagementPermission {
    [IPermissionManagementOptions.own]?: atomicOperation[];
    [IPermissionManagementOptions.role]?: atomicOperation[];
    [IPermissionManagementOptions.job]?: atomicOperation[];
    [IPermissionManagementOptions.query]?: atomicOperation[];
    [IPermissionManagementOptions.ontologyTrees]: atomicOperation[];
}

interface IRoleBase {
    id: string;
    projectId?: string;
    studyId: string;
    name: string;
    permissions: {
        data?: IDataPermission,
        manage?: IManagementPermission
    };
    description: string;
    createdBy: string;
    deleted: number | null;
    metadata: Record<string, unknown>
}

export interface IRole extends IRoleBase {
    users: string[];
}

export interface IRoleQL extends IRoleBase {
    users: IUser[];
}

export interface IProject {
    id: string;
    studyId: string;
    createdBy: string;
    name: string;
    dataVersion?: IStudyDataVersion | null;
    summary?: {
        subjects: string[];
        visits: string[];
        standardizationTypes: string[]
    };
    patientMapping: { [originalId: string]: string };
    lastModified: number;
    deleted: number | null;
    metadata: Record<string, unknown>
}

export interface IDataClip {
    fieldId: string;
    value?: string;
    subjectId: string;
    visitId: string;
    file?: FileUpload;
    metadata?: {
        startDate?: number;
        endDate?: number;
        deviceId?: string;
        [key: string]: unknown
    }
}

export interface ISubjectDataRecordSummary {
    subjectId: string,
    visitId: string,
    fieldId: string,
    error: string
}

export interface IOntologyTree {
    id: string,
    name: string,
    dataVersion: string | null,
    routes?: IOntologyRoute[],
    metadata?: JSON,
    deleted: number
}

export interface IOntologyRoute {
    id: string,
    path: string[],
    name: string,
    field: string[],
    visitRange?: string[]
}

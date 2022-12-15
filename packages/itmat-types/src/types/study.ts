import { IUser } from './user';
import { FileUpload } from 'graphql-upload-minimal';

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
    ontologyTrees?: IOntologyTree[];
    type: studyType;
}

export interface IStudyDataVersion {
    id: string; // uuid
    contentId: string; // same contentId = same data
    version: string;
    tag?: string;
    updateDate: string;
}

interface IRoleBase {
    id: string;
    projectId?: string;
    studyId: string;
    name: string;
    permissions: string[];
    createdBy: string;
    deleted: number | null;
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
    summary?: any;
    patientMapping: { [originalId: string]: string };
    approvedFields: string[];
    approvedFiles: string[];
    lastModified: number;
    deleted: number | null;
}

export interface IDataClip {
    fieldId: string;
    value?: string;
    subjectId: string;
    visitId: string;
    file?: FileUpload;
    metadata?: JSON
}

export interface IGeneralError {
    code: string;
    description?: string
}

export interface ISubjectDataRecordSummary {
    subjectId: string,
    visitId?: string,
    errorFields: string[]
}

export interface IOntologyTree {
    id: string,
    name: string,
    routes?: IOntologyRoute[]
}

export interface IOntologyRoute {
    id: string,
    path: string[],
    name: string,
    field: string[],
    visitRange?: string[]
}

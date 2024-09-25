import { IBase } from './base';
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
}

export interface IStudyDataVersion extends IBase {
    id: string;
    version: string;
    tag?: string;
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
    value: string;
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
    metadata?: Record<string, unknown>,
    deleted: number
}

export interface IOntologyRoute {
    id: string,
    path: string[],
    name: string,
    field: string[],
    visitRange?: string[]
}

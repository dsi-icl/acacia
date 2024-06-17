import { IBase } from './base';

export interface IData extends IBase {
    studyId: string;
    fieldId: string;
    dataVersion: string | null;
    value: unknown;
    properties: Record<string, unknown>;
}

export interface IGroupedData {
    [key: string]: {
        [key: string]: {
            [key: string]: unknown
        }
    }
}

export enum enumDataTransformationOperation {
    GROUP = 'GROUP',
    AFFINE = 'AFFINE',
    LEAVEONE = 'LEAVEONE',
    CONCAT = 'CONCAT',
    DECONCAT = 'DECONCAT',
    JOIN = 'JOIN',
    DEGROUP = 'DEGROUP',
    FILTER = 'FILTER',
    FLATTEN = 'FLATTEN',
    COUNT = 'COUNT'
}
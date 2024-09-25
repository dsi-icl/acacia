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

export interface IDataSetSummary {
    numberOfDataRecords: number;
    numberOfDataAdds: number;
    numberOfDataDeletes: number;

    numberOfVersionedRecords: number;
    numberOfVersionedAdds: number;
    numberOfVersionedDeletes: number;

    numberOfUnversionedRecords: number;
    numberOfUnversionedAdds: number;
    numberOfUnversionedDeletes: number;

    numberOfFields: number;
    numberOfVersionedFields: number;
    numberOfUnversionedFields: number;

    dataByUploaders: Array<{ userId: string, count: number }>;
    dataByUsers: Array<{ userId: string, count: number }>;
}
export interface IFieldEntry {
    id: string;
    studyId: string;
    path: string;
    fieldId: number;
    fieldName: string;
    valueType: enumValueType;
    possibleValues?: string[];
    unit?: string;
    itemType: enumItemType;
    numOfTimePoints: number;
    numOfMeasurements: number;
    startingTimePoint: number;
    startingMeasurement: number;
    notes?: string;
    jobId: string;
    dateAdded: number;
    deleted: number | null;
    fieldTreeId: string;
}

export enum enumItemType {
    IMAGE = 'I',
    CLINICAL = 'C'
}

export enum enumValueType {
    INTEGER = 'i',
    CATEGORICAL = 'c',
    DECIMAL = 'd',
    BOOLEAN = 'b',
    FREETEXT = 't'
}

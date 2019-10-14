export interface IFieldEntry {
    id: string,
    studyId: string,
    path: string,
    fieldId: number,
    fieldName: string,
    valueType: enumValueType,
    possibleValues?: string[],
    unit?: string,
    itemType: enumItemType,
    numOfTimePoints: number,
    numOfMeasurements: number,
    startingTimePoint: number,
    startingMeasurement: number,
    notes?: string,
    jobId: string,
    dateAdded: number,
    deleted: boolean,
    fieldTreeId: string
}

export enum enumItemType {
    IMAGE = 'I',
    CLINICAL = 'C'
}

export enum enumValueType {
    NUMBER = 'N',
    CATEGORICAL = 'C'
}
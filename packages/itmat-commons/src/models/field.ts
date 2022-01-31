export interface IFieldEntry {
    id: string;
    studyId: string;
    fieldId: string;
    fieldName: string;
    tableName?: string;
    dataType: enumValueType;
    possibleValues?: IValueDescription[];
    unit?: string;
    comments?: string;
    dateAdded: string;
    dateDeleted: string | null;
    dataVersion: string | null;
}

export interface IValueDescription {
    id: string;
    code: string;
    description: string
}

export enum enumItemType {
    IMAGE = 'I',
    CLINICAL = 'C'
}

export enum enumValueType {
    INTEGER = 'int',
    DECIMAL = 'dec',
    STRING = 'str',
    BOOLEAN = 'bool',
    DATETIME = 'date',
    FILE = 'file',
    JSON = 'json',
    CATEGORICAL = 'cat'
}

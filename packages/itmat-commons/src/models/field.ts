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
    dateAdded: number;
    deleted: number | null
}

export interface IValueDescription {
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
    BOOLEAN = 'boo',
    DATETIME = 'dat',
    FILE = 'fil',
    JSON = 'jso',
    CATEGORICAL = 'cat'
}

export interface IFieldEntry {
    id: string;
    studyId: string;
    fieldId: number;
    database: string;
    tableName: string;
    tableId: string;
    sequentialOrder: string;
    questionNumber: string;
    fieldName: string;
    label: string;
    labelDe: string;
    labelNl: string;
    labelIt: string;
    labelEs: string;
    labelPl: string;
    labelF: string;
    eligibleAnswer: string;
    ineligibleAnswer: string;
    validation: string;
    dataType: enumValueType;
    controlType: string;
    systemGenerated: boolean;
    valueList: string;
    length: number;
    displayFormat: string;
    nullable: boolean;
    required: boolean;
    mandatory: boolean;
    collectIf: string;
    notMapped: boolean;
    defaultValue: string;
    regEx: string;
    regExErrorMsg: string;
    showOnIndexView: boolean;
    comments: string;
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
    INTEGER = 'int',
    DECIMAL = 'dec',
    STRING = 'str',
    BOOLEAN = 'boo',
    DATETIME = 'dat',
    FILE = 'fil',
    JSON = 'jso'
}

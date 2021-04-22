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
    systemGenerated: string;
    valueList: string;
    length: number;
    displayFormat: string;
    nullable: boolean;
    required: boolean;
    mandatory: boolean;
    collectIf: string;
    notMapped: string;
    defaultValue: string;
    regEx: string;
    regExErrorMsg: string;
    showOnIndexView: string;
    comments: string;
    jobId: string;
    dateAdded: number;
    deleted: number | null;
    fieldTreeId: string;
}

export declare enum enumItemType {
    IMAGE = "I",
    CLINICAL = "C"
}
export declare enum enumValueType {
    INTEGER = "int",
    DECIMAL = "dec",
    CHARACTERS = 'cha',
    BIT = 'bit',
    DATETIME = 'dat'
}

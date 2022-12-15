export interface IStandardization {
    id: string,
    studyId: string,
    type: string,
    field: string[],
    // this path is used only for standardization;
    path: string[],
    stdRules: IStandardizationRule[],
    // records with same path will be joined together
    joinByKeys: string[],
    deleted: number | null,
}

export enum StandardizationRuleSource {
    value = 'value',
    data = 'data',
    fieldDef = 'fieldDef',
    reserved = 'reserved',
    inc = 'inc'
}

export interface IStandardizationRule {
    id: string,
    entry: string,
    source: StandardizationRuleSource,
    parameter: string[],
    // further processings for a value: delete, convert, etc.
    filters?: any
}

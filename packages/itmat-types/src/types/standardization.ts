import { IBase } from './base';

export interface IStandardization extends IBase {
    studyId: string,
    type: string,
    field: string[],
    // this path is used only for standardization;
    path?: string[],
    stdRules?: IStandardizationRule[],
    // records with same path will be joined together
    joinByKeys?: string[],
    dataVersion: string | null,
}

export enum StandardizationRuleSource {
    value = 'value',
    data = 'data',
    fieldDef = 'fieldDef',
    reserved = 'reserved',
    inc = 'inc'
}

export enum StandardizationFilterOptions {
    convert = 'convert',
    delete = 'delete'
}

export interface StandardizationFilterOptionParameters {
    source: 'value' | 'data';
    parameter: string;
}

interface StandardizationRuleFilter {
    [key: string]: Array<StandardizationFilterOptions | StandardizationFilterOptionParameters>
}



export interface IStandardizationRule {
    id: string,
    entry: string,
    source: StandardizationRuleSource,
    parameter: string[],
    // further processings for a value: delete, convert, etc.
    filters?: StandardizationRuleFilter
}

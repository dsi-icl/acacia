import { IBase } from './base';
import { IValueVerifier } from './utils';

export interface IField extends IBase {
    studyId: string;
    fieldName: string;
    fieldId: string;
    description?: string;
    dataType: enumDataTypes;
    categoricalOptions?: ICategoricalOption[];
    unit?: string;
    comments?: string;
    dataVersion: string | null;
    verifier?: IValueVerifier[][];
    properties?: IFieldProperty[]; // mostly used for file data
}

export interface IFieldProperty {
    name: string;
    verifier?: IValueVerifier[][];
    description?: string;
    required: boolean;
}

export enum enumDataTypes {
    INTEGER = 'INTEGER',
    DECIMAL = 'DECIMAL',
    STRING = 'STRING',
    BOOLEAN = 'BOOLEAN',
    DATETIME = 'DATETIME',
    FILE = 'FILE',
    JSON = 'JSON',
    CATEGORICAL = 'CATEGORICAL'
}

export interface ICategoricalOption extends IBase {
    code: string;
    description: string;
}

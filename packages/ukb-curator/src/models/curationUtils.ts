import { ICodingMap, ICodingDictionaryForAField } from './UKBCoding';

export interface IHeaderArrayElement {
    coding?: ICodingDictionaryForAField,
    valueType: string,
    totalArrayNumber: number,
    field: IFieldDescriptionObject
}

export interface IFieldDescriptionObject {
    fieldId: number,
    instance: number,
    array: number
}
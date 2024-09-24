// This file includes old type defs for DMP V2

import { CoreError, ICategoricalOption, IDataClip, IField, enumDataTypes, enumUserTypes } from '@itmat-broker/itmat-types';
import { GraphQLError } from 'graphql';

export interface V2CreateFieldInput {
    fieldId: string;
    fieldName: string
    tableName?: string
    dataType: string;
    possibleValues?: ICategoricalOption[]
    unit?: string
    comments?: string
    metadata?: Record<string, unknown>
}

export interface V2EditFieldInput {
    fieldId: string;
    fieldName: string;
    tableName?: string;
    dataType: string;
    possibleValues?: ICategoricalOption[]
    unit?: string
    comments?: string
}

export interface V2CreateUserInput {
    username: string,
    firstname: string,
    lastname: string,
    email: string,
    emailNotificationsActivated?: boolean,
    password: string,
    description?: string,
    organisation: string,
    metadata: Record<string, unknown> & { logPermission: boolean }
}

export interface V2EditUserInput {
    id: string,
    username?: string,
    type?: enumUserTypes,
    firstname?: string,
    lastname?: string,
    email?: string,
    emailNotificationsActivated?: boolean,
    emailNotificationsStatus?: unknown,
    password?: string,
    description?: string,
    organisation?: string,
    expiredAt?: number,
    metadata?: unknown
}

export function GraphQLErrorDecroator(error: CoreError) {
    throw new GraphQLError(
        error.message,
        { extensions: { code: error.errorCode } }
    );
}

export enum enumV2DataTypes {
    int = 'int',
    dec = 'dec',
    str = 'str',
    bool = 'bool',
    date = 'date',
    file = 'file',
    json = 'json',
    cat = 'cat'
}

/**
 * This function convert the new field type to the old ones for consistency with the GraphQL schema
 */
export function convertV3FieldToV2Field(fields: IField[]) {
    return fields.map((field) => {
        return {
            ...field,
            possibleValues: field.categoricalOptions ? field.categoricalOptions.map((el) => {
                return {
                    id: el.id,
                    code: el.code,
                    description: el.description
                };
            }) : [],
            dataType: (() => {
                if (field.dataType === enumDataTypes.INTEGER) {
                    return enumV2DataTypes.int;
                } else if (field.dataType === enumDataTypes.DECIMAL) {
                    return enumV2DataTypes.dec;
                } else if (field.dataType === enumDataTypes.STRING) {
                    return enumV2DataTypes.str;
                } else if (field.dataType === enumDataTypes.BOOLEAN) {
                    return enumV2DataTypes.bool;
                } else if (field.dataType === enumDataTypes.DATETIME) {
                    return enumV2DataTypes.date;
                } else if (field.dataType === enumDataTypes.FILE) {
                    return enumV2DataTypes.file;
                } else if (field.dataType === enumDataTypes.JSON) {
                    return enumV2DataTypes.json;
                } else if (field.dataType === enumDataTypes.CATEGORICAL) {
                    return enumV2DataTypes.cat;
                } else {
                    return enumV2DataTypes.str;
                }
            })(),
            dateAdded: field.life.createdTime.toString(),
            dateDeleted: field.life.deletedTime ? field.life.deletedTime.toString() : null
        };
    });
}

export function convertV2CreateFieldInputToV3(studyId: string, fields: V2CreateFieldInput[]) {
    return fields.map(field => {
        return {
            studyId: studyId,
            fieldName: field.fieldName,
            fieldId: field.fieldId,
            description: undefined,
            dataType: (() => {
                if (field.dataType === enumV2DataTypes.int) {
                    return enumDataTypes.INTEGER;
                } else if (field.dataType === enumV2DataTypes.dec) {
                    return enumDataTypes.DECIMAL;
                } else if (field.dataType === enumV2DataTypes.str) {
                    return enumDataTypes.STRING;
                } else if (field.dataType === enumV2DataTypes.bool) {
                    return enumDataTypes.BOOLEAN;
                } else if (field.dataType === enumV2DataTypes.date) {
                    return enumDataTypes.DATETIME;
                } else if (field.dataType === enumV2DataTypes.file) {
                    return enumDataTypes.FILE;
                } else if (field.dataType === enumV2DataTypes.json) {
                    return enumDataTypes.JSON;
                } else if (field.dataType === enumV2DataTypes.cat) {
                    return enumDataTypes.CATEGORICAL;
                } else {
                    return enumDataTypes.STRING;
                }
            })(),
            categoricalOptions: field.possibleValues?.map(el => {
                return {
                    id: el.id,
                    code: el.code,
                    description: el.description
                };
            }),
            properties: [{
                name: 'subjectId',
                required: true
            }, {
                name: 'visitId',
                required: false
            }],
            unit: field.unit,
            comments: field.comments
        };
    });
}

export function convertV2EditFieldInputToV3(studyId: string, fields: V2EditFieldInput[]) {
    return fields.map(field => {
        return {
            studyId: studyId,
            fieldName: field.fieldName,
            fieldId: field.fieldId,
            description: undefined,
            dataType: (() => {
                if (field.dataType === enumV2DataTypes.int) {
                    return enumDataTypes.INTEGER;
                } else if (field.dataType === enumV2DataTypes.dec) {
                    return enumDataTypes.DECIMAL;
                } else if (field.dataType === enumV2DataTypes.str) {
                    return enumDataTypes.STRING;
                } else if (field.dataType === enumV2DataTypes.bool) {
                    return enumDataTypes.BOOLEAN;
                } else if (field.dataType === enumV2DataTypes.date) {
                    return enumDataTypes.DATETIME;
                } else if (field.dataType === enumV2DataTypes.file) {
                    return enumDataTypes.FILE;
                } else if (field.dataType === enumV2DataTypes.json) {
                    return enumDataTypes.JSON;
                } else if (field.dataType === enumV2DataTypes.cat) {
                    return enumDataTypes.CATEGORICAL;
                } else {
                    return enumDataTypes.STRING;
                }
            })(),
            categoricalOptions: field.possibleValues?.map(el => {
                return {
                    id: el.id,
                    code: el.code,
                    description: el.description
                };
            }),
            unit: field.unit,
            comments: field.comments
        };
    });
}

export function convertV2DataClipInputToV3(dataclip: IDataClip[]) {
    return dataclip.map(el => {
        return {
            fieldId: el.fieldId,
            value: el.value,
            properties: {
                subjectId: el.subjectId,
                visitId: el.visitId
            }
        };
    });
}

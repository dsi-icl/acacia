import { IField, enumDataTypes, ICategoricalOption, IValueVerifier, IGenericResponse, enumConfigType, defaultSettings, IAST, enumConditionOps, enumFileTypes, enumFileCategories, IFieldProperty, IFile, IData, enumASTNodeTypes, IRole, IStudyConfig, enumUserTypes, enumCoreErrors, IUserWithoutToken, CoreError, enumDataAtomicPermissions, enumDataTransformationOperation, enumCacheStatus, enumCacheType, FileUpload, enumStudyRoles, IDataSetSummary } from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { DBType } from '../database/database';
import { FileCore } from './fileCore';
import { PermissionCore } from './permissionCore';
import { makeGenericResponse, convertToBufferAndUpload, getJsonFileContents } from '../utils';
import { UtilsCore } from './utilsCore';
import { Filter } from 'mongodb';
import { DataTransformationCore } from './transformationCore';
import { Readable } from 'stream';
import { ObjectStore } from '@itmat-broker/itmat-commons';

type IDataTransformationClip = Record<string, unknown>;

type IDataTransformationClipArray = IDataTransformationClip[];

interface IDataInput {
    fieldId: string;
    value: string; // null for deleted data
    properties?: Record<string, unknown>;
}

interface ValueVerifierInput {
    formula: IAST;
    condition: enumConditionOps;
    value: string | number;
    parameters: Record<string, unknown>;
}

interface CategoticalOptionInput {
    code: string;
    description: string;
}

interface CreateFieldInput {
    studyId: string;
    fieldName: string;
    fieldId: string;
    description?: string;
    dataType: enumDataTypes;
    categoricalOptions?: CategoticalOptionInput[];
    unit?: string;
    comments?: string;
    verifier?: ValueVerifierInput[][];
    properties?: IFieldProperty[];
    metadata?: Record<string, unknown>;
}

type EditFieldInput = CreateFieldInput;

export class DataCore {
    db: DBType;
    objStore: ObjectStore;
    fileCore: FileCore;
    permissionCore: PermissionCore;
    utilsCore: UtilsCore;
    dataTransformationCore: DataTransformationCore;
    constructor(db: DBType, objStore: ObjectStore, fileCore: FileCore, permissionCore: PermissionCore, utilsCore: UtilsCore, dataTransformationCore: DataTransformationCore) {
        this.db = db;
        this.objStore = objStore;
        this.fileCore = fileCore;
        this.permissionCore = permissionCore;
        this.utilsCore = utilsCore;
        this.dataTransformationCore = dataTransformationCore;
    }

    /**
     * Get the list of fields of a study. Note, duplicate fields will be joined and only remain the latest one.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param dataVersions - The data version; if not specified, use the latest one (include all previous ones) by default.
     * @param selectedFields - The list of ids of fields to return.
     *
     * @return IField[] - The list of objects of IField.
     */
    public async getStudyFields(requester: IUserWithoutToken | undefined, studyId: string, dataVersion?: string | null | Array<string | null>, selectedFields?: string[]) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, requester.id, studyId);
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const regularExpressions: string[] = [];
        for (const role of roles) {
            for (const permission of role.dataPermissions) {
                for (const fieldRE of permission.fields) {
                    if ((permission.permission & 4) === 4) {
                        regularExpressions.push(fieldRE);
                    }
                }
            }
        }
        let availableDataVersions: Array<string | null> = [];
        if (dataVersion === null) {
            availableDataVersions.push(null);
        } else if (typeof dataVersion === 'string') {
            availableDataVersions.push(dataVersion);
        } else if (Array.isArray(dataVersion)) {
            availableDataVersions.push(...dataVersion);
        } else {
            availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        }
        const fields = await this.db.collections.field_dictionary_collection.aggregate<IField>([{
            $match: {
                $and: [
                    { studyId: studyId, dataVersion: { $in: availableDataVersions } },
                    { fieldId: selectedFields ? { $in: selectedFields } : { $in: regularExpressions.map(el => new RegExp(el)) } },
                    { fieldId: { $in: [new RegExp('^.*$')] } }
                ]
            }
        }, {
            $sort: {
                'life.createdTime': -1
            }
        }, {
            $group: {
                _id: '$fieldId',
                doc: { $first: '$$ROOT' }
            }
        }, {
            $replaceRoot: {
                newRoot: '$doc'
            }
        }], { allowDiskUse: true }).toArray();
        return fields.filter(el => el.life.deletedTime === null);
    }
    /**
     * Create a field of a study. To adjust to data versioning, create an existing field wil not throw an error.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param fieldName - The name of the field.
     * @param fieldId - The value of the id of the field. Should be unique.
     * @param description - The description of the field.
     * @param dataType - The dataType of the field.
     * @param categoricalOptions - The options of the field if the field is a categorical field.
     * @param unit - The unit of the field.
     * @param comments - The comments of the field.
     * @param verifier - The verifier of the field.
     * @param properties - The properties of the field.
     *
     * @return IField
     */
    public async createField(requester: IUserWithoutToken | undefined, fieldInput: CreateFieldInput): Promise<IField> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const roles = await this.permissionCore.getRolesOfUser(requester, requester.id, fieldInput.studyId);
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        let hasPermission = false;
        for (const role of roles) {
            for (const permission of role.dataPermissions) {
                for (const fieldRE of permission.fields) {
                    if (new RegExp(fieldRE).test(fieldInput.fieldId) && (permission.permission & 2) === 2) {
                        hasPermission = true;
                    }
                }
            }
        }

        if (!hasPermission) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'No permission to create this field.'
            );
        }

        const errors = this.validateFieldEntry(fieldInput);
        if (errors.length > 0) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                errors[0]
            );
        }

        // add id and life for verifier;
        const verifierWithId: IValueVerifier[][] = [];
        if (fieldInput.verifier) {
            for (let i = 0; i < fieldInput.verifier.length; i++) {
                verifierWithId.push([]);
                for (let j = 0; j < fieldInput.verifier[i].length; j++) {
                    verifierWithId[verifierWithId.length - 1].push({
                        ...fieldInput.verifier[i][j]
                    });
                }
            }
        }

        let categoricalOptionsWithId: ICategoricalOption[] | undefined = undefined;
        if (fieldInput.categoricalOptions) {
            categoricalOptionsWithId = [];
            for (let i = 0; i < fieldInput.categoricalOptions.length; i++) {
                categoricalOptionsWithId.push({
                    ...fieldInput.categoricalOptions[i],
                    id: uuid(),
                    life: {
                        createdTime: Date.now(),
                        createdUser: requester.id,
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                });
            }
        }

        const fieldEntry: IField = {
            id: uuid(),
            studyId: fieldInput.studyId,
            fieldId: fieldInput.fieldId,
            fieldName: fieldInput.fieldName,
            description: fieldInput.description,
            dataType: fieldInput.dataType,
            categoricalOptions: categoricalOptionsWithId,
            unit: fieldInput.unit,
            comments: fieldInput.comments,
            dataVersion: null,
            verifier: verifierWithId,
            properties: fieldInput.dataType === enumDataTypes.FILE ? [
                ...(fieldInput.properties ?? []),
                {
                    name: 'FileName',
                    required: true
                }
            ] : fieldInput.properties,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: fieldInput.metadata ?? {}
        };

        await this.db.collections.field_dictionary_collection.insertOne(fieldEntry);

        return fieldEntry;
    }
    /**
     * Edit a field of a study.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param fieldName - The name of the field.
     * @param fieldId - The value of the id of the field. Should be unique.
     * @param description - The description of the field.
     * @param dataType - The dataType of the field.
     * @param categoricalOptions - The options of the field if the field is a categorical field.
     * @param unit - The unit of the field.
     * @param comments - The comments of the field.
     * @param verifier - The verifier of the field.
     * @param properties - The properties of the field.
     *
     * @return IField
     */
    public async editField(requester: IUserWithoutToken | undefined, fieldInput: EditFieldInput): Promise<IGenericResponse> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const roles = await this.permissionCore.getRolesOfUser(requester, requester.id, fieldInput.studyId);
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        let hasPermission = false;
        for (const role of roles) {
            for (const permission of role.dataPermissions) {
                for (const fieldRE of permission.fields) {
                    if (new RegExp(fieldRE).test(fieldInput.fieldId) && (permission.permission & 2) === 2) {
                        hasPermission = true;
                    }
                }
            }
        }

        if (!hasPermission) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'No permission to create this field.'
            );
        }

        const field = await this.db.collections.field_dictionary_collection.findOne({ 'studyId': fieldInput.studyId, 'fieldId': fieldInput.fieldId, 'life.deletedTime': null });
        if (!field) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Field does not exist.'
            );
        }

        const errors = this.validateFieldEntry(fieldInput);

        if (errors.length > 0) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                errors[0]
            );
        }

        const verifierWithId: IValueVerifier[][] = [];
        if (fieldInput.verifier) {
            for (let i = 0; i < fieldInput.verifier.length; i++) {
                verifierWithId.push([]);
                for (let j = 0; j < fieldInput.verifier[i].length; j++) {
                    verifierWithId[verifierWithId.length - 1].push({
                        ...fieldInput.verifier[i][j]
                    });
                }
            }
        }

        let categoricalOptionsWithId: ICategoricalOption[] | undefined = field.categoricalOptions;
        if (fieldInput.categoricalOptions) {
            categoricalOptionsWithId = [];
            for (let i = 0; i < fieldInput.categoricalOptions.length; i++) {
                categoricalOptionsWithId.push({
                    ...fieldInput.categoricalOptions[i],
                    id: uuid(),
                    life: {
                        createdTime: Date.now(),
                        createdUser: requester.id,
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                });
            }
        }

        // insert directly
        await this.db.collections.field_dictionary_collection.insertOne({
            id: uuid(),
            studyId: fieldInput.studyId,
            fieldId: fieldInput.fieldId,
            fieldName: fieldInput.fieldName ?? field.fieldName,
            description: fieldInput.description ?? field.description,
            dataType: fieldInput.dataType ?? field.dataType,
            categoricalOptions: categoricalOptionsWithId,
            unit: fieldInput.unit ?? field.unit,
            comments: fieldInput.comments ?? field.comments,
            dataVersion: null,
            verifier: fieldInput.verifier ? verifierWithId : field.verifier,
            properties: fieldInput.properties ?? field.properties,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {}
        });

        return makeGenericResponse(fieldInput.fieldId, true, undefined, `Field ${fieldInput.fieldId} has been edited.`);
    }

    /**
     * Delete a field of a study.
     *
     * @param requester - The requester.
     * @param studyId - The id of the stduy.
     * @param fieldId - The id of the field.
     *
     * @return IGenericResponse
     */
    public async deleteField(requester: IUserWithoutToken | undefined, studyId: string, fieldId: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const roles = await this.permissionCore.getRolesOfUser(requester, requester.id, studyId);
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        let hasPermission = false;
        for (const role of roles) {
            for (const permission of role.dataPermissions) {
                for (const fieldRE of permission.fields) {
                    if (new RegExp(fieldRE).test(fieldId) && (permission.permission & 1) === 1) {
                        hasPermission = true;
                    }
                }
            }
        }

        if (!hasPermission) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'No permission to delete this field.'
            );
        }

        const field = (await this.db.collections.field_dictionary_collection.find({ studyId: studyId, fieldId: fieldId }).sort({ 'life.createdTime': -1 }).limit(1).toArray())[0];
        if (!field || field.life.deletedTime) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Field does not exist.'
            );
        }

        await this.db.collections.field_dictionary_collection.insertOne({
            id: uuid(),
            studyId: studyId,
            fieldId: fieldId,
            fieldName: field.fieldName,
            description: field.description,
            dataType: field.dataType,
            categoricalOptions: field.categoricalOptions,
            unit: field.unit,
            comments: field.comments,
            dataVersion: null,
            verifier: field.verifier,
            properties: field.properties,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: Date.now(),
                deletedUser: requester.id
            },
            metadata: {}
        });
        return makeGenericResponse(fieldId, true, undefined, `Field ${fieldId} has been deleted.`);
    }

    /**
     * Validate field entry. This function only checks the input parameters without interacting with the database.
     *
     * @param fieldInput - The field input object.
     *
     * @return array[] - The error array, empty for null errors.
    */
    public validateFieldEntry(fieldInput: CreateFieldInput): string[] {
        const errors: string[] = [];
        // check missing field
        const complusoryField: Array<keyof IField> = [
            'fieldId',
            'fieldName',
            'dataType'
        ];
        for (const key of complusoryField) {
            if (fieldInput[key] === undefined && fieldInput[key] === null) {
                errors.push(`${key} should not be empty.`);
                return errors;
            }
        }

        // only english letters, numbers and _ are allowed in fieldIds
        if (!/^[a-zA-Z0-9_]*$/.test(fieldInput.fieldId || '')) {
            errors.push('FieldId should contain letters, numbers and _ only.');
            return errors;
        }
        // data types
        if (!Object.values(enumDataTypes).includes(fieldInput.dataType)) {
            errors.push(`Data type shouldn't be ${fieldInput.dataType}: use 'INTEGER' for integer, 'DECIMAL' for decimal, 'STRING' for string, 'BOOLEAN' for boolean, 'DATETIME' for datetime, 'FILE' for file, 'JSON' for json and 'CATEGORICAL' for categorical.`);
            return errors;
        }
        // check possiblevalues to be not-empty if datatype is categorical
        if (fieldInput.dataType === enumDataTypes.CATEGORICAL) {
            if (fieldInput.categoricalOptions !== undefined && fieldInput.categoricalOptions !== null) {
                if (fieldInput.categoricalOptions.length === 0) {
                    errors.push(`${fieldInput.fieldId}-${fieldInput.fieldName}: possible values can't be empty if data type is categorical.`);
                    return errors;
                }
                for (let i = 0; i < fieldInput.categoricalOptions.length; i++) {
                    fieldInput.categoricalOptions[i]['id'] = uuid();
                }
            } else {
                errors.push(`${fieldInput.fieldId}-${fieldInput.fieldName}: possible values can't be empty if data type is categorical.`);
                return errors;
            }
        }
        return errors;
    }

    /**
     * Upload data clips to a study.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param data - The list of data clips.
     *
     * @return IGenericResponse - The list of objects of IGenericResponse
     */
    public async uploadData(requester: IUserWithoutToken | undefined, studyId: string, data: IDataInput[]) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const availableDataVersions: Array<string | null> = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
        availableDataVersions.push(null);
        const availableFields = await this.getStudyFields(requester, studyId, availableDataVersions);
        const availableFieldsMapping: Record<string, IField> = availableFields.reduce((acc: Record<string, IField>, el: IField) => {
            acc[el.fieldId] = el;
            return acc;
        }, {});


        const studyConfig = ((await this.db.collections.configs_collection.findOne({ type: enumConfigType.STUDYCONFIG, key: studyId }))?.properties ?? defaultSettings.studyConfig) as IStudyConfig;

        const response: IGenericResponse[] = [];
        let bulk = this.db.collections.data_collection.initializeUnorderedBulkOp();
        let counter = -1; // index of the data
        for (const dataClip of data) {
            counter++;
            const hasPermission = await this.permissionCore.checkFieldOrDataPermission(requester, studyId, dataClip, enumDataAtomicPermissions.WRITE);
            if (!hasPermission) {
                response.push(makeGenericResponse(counter.toString(), false, enumCoreErrors.NO_PERMISSION_ERROR, enumCoreErrors.NO_PERMISSION_ERROR));
                continue;
            }

            if (!(dataClip.fieldId in availableFieldsMapping)) {
                response.push(makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, `Field ${dataClip.fieldId}: Field not found`));
                continue;
            }

            /* Check value is value */
            let error: IGenericResponse | undefined = undefined;
            let parsedValue: unknown;
            if (dataClip.value.toString() === studyConfig.defaultRepresentationForMissingValue) {
                parsedValue = studyConfig.defaultRepresentationForMissingValue;
            } else {
                if (!(dataClip.fieldId in availableFieldsMapping)) {
                    error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY, `Field ${dataClip.fieldId}: Field not found`);
                    response.push(error);
                    continue;
                }
                const field = availableFieldsMapping[dataClip.fieldId];
                switch (field.dataType) {
                    case enumDataTypes.DECIMAL: {// decimal
                        if (typeof (dataClip.value) !== 'string') {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as decimal.`);
                            break;
                        }
                        if (!/^-?\d+(\.\d+)?$/.test(dataClip.value)) {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as decimal.`);
                            break;
                        }
                        parsedValue = parseFloat(dataClip.value);
                        break;
                    }
                    case enumDataTypes.INTEGER: {// integer
                        if (typeof (dataClip.value) !== 'string') {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as integer.`);
                            break;
                        }
                        if (!/^-?\d+$/.test(dataClip.value)) {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as integer.`);
                            break;
                        }
                        parsedValue = parseInt(dataClip.value, 10);
                        break;
                    }
                    case enumDataTypes.BOOLEAN: {// boolean
                        if (typeof (dataClip.value) !== 'string') {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as boolean.`);
                            break;
                        }
                        if (dataClip.value.toString().toLowerCase() === 'true' || dataClip.value.toString().toLowerCase() === 'false') {
                            parsedValue = dataClip.value.toLowerCase() === 'true';
                        } else {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as boolean.`);
                            break;
                        }
                        break;
                    }
                    case enumDataTypes.STRING: {
                        if (typeof (dataClip.value) !== 'string') {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as string.`);
                            break;
                        }
                        parsedValue = dataClip.value.toString();
                        break;
                    }
                    case enumDataTypes.DATETIME: {
                        if (typeof (dataClip.value) !== 'string') {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as date. Value for date type must be in ISO format.`);
                            break;
                        }
                        const matcher = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?/;
                        if (!dataClip.value.match(matcher)) {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as date. Value for date type must be in ISO format.`);
                            break;
                        }
                        parsedValue = dataClip.value.toString();
                        break;
                    }
                    case enumDataTypes.JSON: {
                        parsedValue = JSON.parse(dataClip.value);
                        break;
                    }
                    case enumDataTypes.FILE: {
                        parsedValue = dataClip.value;
                        break;
                    }
                    case enumDataTypes.CATEGORICAL: {
                        if (!(availableFieldsMapping[dataClip.fieldId].categoricalOptions)) {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as categorical, possible values not defined.`);
                            break;
                        }
                        if (!((availableFieldsMapping[dataClip.fieldId].categoricalOptions as ICategoricalOption[]).map((el) => el.code).includes(dataClip.value?.toString()))) {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Cannot parse as categorical, value not in value list.`);
                            break;
                        } else {
                            parsedValue = dataClip.value?.toString();
                        }
                        break;
                    }
                    default: {
                        error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Invalid data Type.`);
                        break;
                    }
                }
                const verifier = availableFieldsMapping[dataClip.fieldId].verifier;
                if (verifier && verifier.length) {
                    const resEach: boolean[] = [];
                    for (let i = 0; i < verifier.length; i++) {
                        resEach.push(true);
                        for (let j = 0; j < verifier[i].length; j++) {
                            if ((typeof parsedValue !== 'string' && typeof parsedValue !== 'number') || !this.utilsCore.validValueWithVerifier(parsedValue, verifier[i][j])) {
                                resEach[resEach.length - 1] = false;
                                break;
                            }
                        }
                    }
                    if (resEach.every(el => !el)) {
                        error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId} value ${parsedValue}: Failed to pass the verifier.`);
                    }
                }
                if (field.properties) {
                    for (const property of field.properties) {
                        if (property.required && (!dataClip.properties || dataClip.properties[property.name] === undefined)) {
                            error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId}: Property ${property.name} is required.`);
                            break;
                        }
                        if (property.verifier && dataClip.properties) {
                            const resEach: boolean[] = [];
                            for (let i = 0; i < property.verifier.length; i++) {
                                resEach.push(true);
                                for (let j = 0; j < property.verifier[i].length; j++) {
                                    if ((typeof dataClip.properties[property.name] !== 'string' && typeof dataClip.properties[property.name] !== 'number') ||
                                        !this.utilsCore.validValueWithVerifier(dataClip.properties[property.name] as string | number, property.verifier[i][j])) {
                                        resEach[resEach.length - 1] = false;
                                        break;
                                    }
                                }
                            }
                            if (resEach.every(el => !el)) {
                                error = makeGenericResponse(counter.toString(), false, enumCoreErrors.CLIENT_MALFORMED_INPUT, `Field ${dataClip.fieldId} value ${dataClip.properties[property.name]}: Property ${property.name} failed to pass the verifier.`);
                            }
                        }
                    }
                }
            }
            if (error) {
                response.push(error);
                continue;
            } else {
                response.push(makeGenericResponse(counter.toString(), true, undefined, `Field ${dataClip.fieldId} value ${dataClip.value} successfully uploaded.`));
            }

            bulk.insert({
                id: uuid(),
                studyId: study.id,
                fieldId: dataClip.fieldId,
                dataVersion: null,
                value: parsedValue,
                properties: dataClip.properties,
                life: {
                    createdTime: Date.now(),
                    createdUser: requester.id,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            });

            if (bulk.batches.length > 999) {
                await bulk.execute();
                bulk = this.db.collections.data_collection.initializeUnorderedBulkOp();
            }
        }
        if (bulk.batches.length !== 0)
            await bulk.execute();
        return response;
    }

    /**
     * Get the data of a study.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param fieldIds - The list of regular expressions of fields to return.
     * @param dataVersions - The list of data versions to return.
     * @param aggregation - The pipeline of the data aggregation.
     * @param useCache - Whether to use the cached data.
     * @param forceUpdate - Whether to force update the cache.
     *
     * @return Partial<IData>[] - The list of objects of Partial<IData>
     */
    public async getData(requester: IUserWithoutToken | undefined, studyId: string, selectedFieldIds?: string[], dataVersion?: string | null | Array<string | null>, aggregation?: Record<string, Array<{ operationName: enumDataTransformationOperation, params: Record<string, unknown> }>>, useCache?: boolean, forceUpdate?: boolean, fromCold?: boolean) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const roles = (await this.permissionCore.getRolesOfUser(requester, requester.id, studyId));
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const config = await this.db.collections.configs_collection.findOne({ type: enumConfigType.STUDYCONFIG, key: studyId });
        if (!config) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study config not found.'
            );
        }

        let fieldIds: string[] | undefined = selectedFieldIds;
        let availableDataVersions: Array<string | null> = [];
        if (dataVersion === null) {
            availableDataVersions.push(null);
        } else if (typeof dataVersion === 'string') {
            availableDataVersions.push(dataVersion);
        } else if (Array.isArray(dataVersion)) {
            availableDataVersions.push(...dataVersion);
        } else {
            availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
            availableDataVersions.push(null);
        }
        if (!fieldIds) {
            fieldIds = (await this.getStudyFields(requester, studyId, availableDataVersions)).map(el => el.fieldId);
        }

        /** Check hash first */
        let hash: string;
        if (useCache) {
            hash = this.utilsCore.computeHash({
                query: 'getData',
                requester: requester.id,
                studyId: studyId,
                fieldIds: fieldIds,
                dataVersion: dataVersion,
                aggregation: aggregation
            });
            const hashedInfo = await this.db.collections.cache_collection.find({ 'keyHash': hash, 'life.deletedTime': null, 'status': enumCacheStatus.INUSE }).sort({ 'life.createdTime': -1 }).limit(1).toArray();
            if (hashedInfo.length === 1 && !forceUpdate) {
                return await getJsonFileContents(this.objStore, 'cache', hashedInfo[0].uri);
            } else {
                // raw data by the permission
                const data = await this.getDataByRoles(requester, roles, studyId, availableDataVersions, fieldIds, fromCold);
                // data transformation if aggregation is provided
                const transformed = aggregation ? this.dataTransformationCore.transformationAggregate(data as unknown as IDataTransformationClipArray, aggregation) : data;
                // write to minio and cache collection
                const info = await convertToBufferAndUpload(this.fileCore, requester, { data: data });
                const newHashInfo = {
                    id: uuid(),
                    keyHash: hash,
                    uri: info.uri,
                    life: {
                        createdTime: Date.now(),
                        createdUser: requester.id,
                        deletedTime: null,
                        deletedUser: null
                    },
                    status: enumCacheStatus.INUSE,
                    keys: {
                        query: 'getData',
                        requester: requester,
                        studyId: studyId,
                        fieldIds: fieldIds,
                        dataVersions: availableDataVersions,
                        aggregation: aggregation
                    },
                    type: enumCacheType.API,
                    metadata: {}
                };
                await this.db.collections.cache_collection.insertOne(newHashInfo);
                return transformed;
            }
        } else {
            // raw data by the permission
            const data = await this.getDataByRoles(requester, roles, studyId, availableDataVersions, fieldIds, fromCold);
            // data transformation if aggregation is provided
            const transformed = aggregation ? this.dataTransformationCore.transformationAggregate(data as unknown as IDataTransformationClipArray, aggregation) : data;
            return transformed;
        }
    }

    /**
     * This is a shortcut function to get the latest data of a study.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param fieldIds - The list of regular expressions of fields to return.
     * @returns
     */
    public async getDataLatest(requester: IUserWithoutToken | undefined, studyId: string, selectedFieldIds?: string[]) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const roles = (await this.permissionCore.getRolesOfUser(requester, requester.id, studyId));
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const config = await this.db.collections.configs_collection.findOne({ type: enumConfigType.STUDYCONFIG, key: studyId });
        if (!config) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study config not found.'
            );
        }

        const fieldIds: string[] | undefined = selectedFieldIds;
        const matchFilter: Filter<IData> = {
            studyId: studyId
        };

        const roleArr: Filter<IData>[] = [];
        for (const role of roles) {
            const permissionArr: Filter<IData>[] = [];
            for (let i = 0; i < role.dataPermissions.length; i++) {
                if (role.dataPermissions[i].fields.length === 0) {
                    continue;
                }
                const obj = {
                    fieldId: { $in: role.dataPermissions[i].fields.map(el => new RegExp(el)) }
                };
                if (role.dataPermissions[i].dataProperties) {
                    for (const key of Object.keys(role.dataPermissions[i].dataProperties)) {
                        obj[`properties.${key}`] = { $in: role.dataPermissions[i].dataProperties[key].map(el => new RegExp(el)) };
                    }
                }
                if (!role.dataPermissions[i].includeUnVersioned) {
                    obj['dataVersion'] = { $ne: null };
                }
                permissionArr.push(obj);
            }
            if (permissionArr.length === 0) {
                return [];
            }
            roleArr.push({ $or: permissionArr });
        }
        const dataVersions: Array<string | null> = study.dataVersions.map(el => el.id);
        dataVersions.push(null);
        // we need to query each field based on its properties
        const availableFields = (await this.getStudyFields(requester, studyId, dataVersions)).reduce((a, c) => {
            a[c.fieldId] = c;
            return a;
        }, {});
        const availableFieldIds = Object.keys(availableFields);
        const refactoredFieldIds = fieldIds ?? Object.keys(availableFields);
        let res: IData[] = [];

        const queries = refactoredFieldIds.map(async (fieldId) => {
            if (availableFieldIds.includes(fieldId) || availableFieldIds.some(el => new RegExp(el).test(fieldId))) {
                const propertyFilter: Record<string, string> = {};
                if (availableFields[fieldId].properties) {
                    for (const property of availableFields[fieldId].properties) {
                        propertyFilter[`${property.name}`] = `$properties.${property.name}`;
                    }
                }

                const data = await this.db.collections.colddata_collection.aggregate<IData>([{
                    $match: { ...matchFilter, fieldId: fieldId }
                }, {
                    $match: { $or: [{ $or: roleArr }, { 'life.createdUser': requester.id }] }
                }, {
                    $sort: {
                        'life.createdTime': -1
                    }
                }, {
                    $group: {
                        _id: {
                            ...propertyFilter
                        },
                        latestDocument: { $first: '$$ROOT' }
                    }
                }, {
                    $replaceRoot: { newRoot: '$latestDocument' }
                }, {
                    $project: {
                        _id: 0,
                        id: 0,
                        dataVersion: 0,
                        life: 0,
                        metadata: 0
                    }
                }], { allowDiskUse: true }).toArray();

                return data;
            } else {
                return [];
            }
        });

        // Execute all queries in parallel and wait for the results
        const results = await Promise.all(queries);

        // Flatten the array of results and concatenate it into the final `res` array
        res = results.flat();
        return res;

    }

    /**
     * Get the latest files of a study. Note in this case the file will have a version. This function reuse the getData function.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param selectedFieldIds - The list of regular expressions of fields to return.
     * @param dataVersion - The list of data versions to return.
     * @returns IFile[] - The list of objects of IFile
     */
    public async getStudyFilesLatest(requester: IUserWithoutToken | undefined, studyId: string, selectedFieldIds?: string[], dataVersion?: string | null | Array<string | null>, readable?: boolean, useCache?: boolean, forceUpdate?: boolean) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const roles = (await this.permissionCore.getRolesOfUser(requester, requester.id, studyId));
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const config = await this.db.collections.configs_collection.findOne({ type: enumConfigType.STUDYCONFIG, key: studyId });
        if (!config) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study config not found.'
            );
        }

        const readFiles = async () => {
            let fieldIds: string[] | undefined = selectedFieldIds;
            let availableDataVersions: Array<string | null> = [];
            if (dataVersion === null) {
                availableDataVersions.push(null);
            } else if (typeof dataVersion === 'string') {
                availableDataVersions.push(dataVersion);
            } else if (Array.isArray(dataVersion)) {
                availableDataVersions.push(...dataVersion);
            } else {
                availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
                availableDataVersions.push(null);
            }
            if (!fieldIds) {
                fieldIds = (await this.getStudyFields(requester, studyId, availableDataVersions)).filter(el => el.dataType === enumDataTypes.FILE).map(el => el.fieldId);
            } else {
                const fields = await this.db.collections.field_dictionary_collection.find({ studyId: studyId, fieldId: { $in: fieldIds } }).toArray();
                fieldIds = fields.filter(el => el.dataType === enumDataTypes.FILE).map(el => el.fieldId);
            }
            if (fieldIds.length === 0) {
                return [];
            }
            const fileDataRecords: IData[] = (await this.getDataLatest(
                requester,
                studyId,
                fieldIds
            )) as unknown as IData[];
            if (!Array.isArray(fileDataRecords)) {
                return [];
            }
            const batchSize = 10000; // Define a suitable batch size
            const promises: Promise<Partial<IFile>[]>[] = [];

            for (let i = 0; i < fileDataRecords.length; i += batchSize) {
                const batchIds = fileDataRecords.slice(i, i + batchSize).map(el => String(el.value));
                const promise = this.db.collections.files_collection.find({ id: { $in: batchIds } }, { allowDiskUse: true })
                    .project({
                        '_id': 0,
                        'fileType': 0,
                        'fileCategory': 0,
                        'sharedUsers': 0,
                        'life.deletedTime': 0,
                        'life.deletedUser': 0
                    }).toArray();
                promises.push(promise);
            }

            const files = (await Promise.all(promises)).flat(); // Flatten the array of arrays
            if (readable) {
                const users = await this.db.collections.users_collection.find({}).toArray();
                const edited = [...files];
                for (const file of edited) {
                    const user = users.find(el => el.id === file.life?.createdUser);
                    if (file.life) {
                        file.life.createdUser = user ? `${user.firstname} ${user.lastname}` : file.life?.createdUser;
                    }
                }
                return edited;
            } else {
                return files;
            }
        };

        if (useCache) {
            const hash = this.utilsCore.computeHash({
                query: 'getStudyFiles',
                studyId: studyId,
                roles: roles,
                fieldIds: selectedFieldIds
            });
            const hashedInfo = await this.db.collections.cache_collection.find({ 'keyHash': hash, 'life.deletedTime': null, 'status': enumCacheStatus.INUSE }).sort({ 'life.createdTime': -1 }).limit(1).toArray();
            // if hash is not found, generate the new summary and cache it
            if (forceUpdate || !hashedInfo || hashedInfo.length === 0) {
                const newFiles = await readFiles();
                const info = await convertToBufferAndUpload(this.fileCore, requester, { files: newFiles });
                await this.db.collections.cache_collection.insertOne({
                    id: uuid(),
                    keyHash: hash,
                    uri: info.uri,
                    status: enumCacheStatus.INUSE,
                    keys: {
                        query: 'getStudyFiles',
                        studyId: studyId,
                        roles: roles,
                        fieldIds: selectedFieldIds
                    },
                    type: enumCacheType.API,
                    life: {
                        createdTime: Date.now(),
                        createdUser: requester.id,
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                });
                return newFiles;
            } else {
                return ((await getJsonFileContents(this.objStore, 'cache', hashedInfo[0].uri)) as unknown as { files: IFile[] }).files;
            }
        } else {
            return await readFiles();
        }

    }

    /**
     * Get the files of a study. This function reuse the getData function.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param selectedFieldIds - The list of regular expressions of fields to return.
     * @param dataVersion - The list of data versions to return.
     * @returns IFile[] - The list of objects of IFile
     */
    public async getStudyFiles(requester: IUserWithoutToken | undefined, studyId: string, selectedFieldIds?: string[], dataVersion?: string | null | Array<string | null>, readable?: boolean, useCache?: boolean, forceUpdate?: boolean) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const roles = (await this.permissionCore.getRolesOfUser(requester, requester.id, studyId));
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const config = await this.db.collections.configs_collection.findOne({ type: enumConfigType.STUDYCONFIG, key: studyId });
        if (!config) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study config not found.'
            );
        }

        const readFiles = async () => {
            let fieldIds: string[] | undefined = selectedFieldIds;
            let availableDataVersions: Array<string | null> = [];
            if (dataVersion === null) {
                availableDataVersions.push(null);
            } else if (typeof dataVersion === 'string') {
                availableDataVersions.push(dataVersion);
            } else if (Array.isArray(dataVersion)) {
                availableDataVersions.push(...dataVersion);
            } else {
                availableDataVersions = (study.currentDataVersion === -1 ? [] : study.dataVersions.filter((__unused__el, index) => index <= study.currentDataVersion)).map(el => el.id);
                availableDataVersions.push(null);
            }
            if (!fieldIds) {
                fieldIds = (await this.getStudyFields(requester, studyId, availableDataVersions)).filter(el => el.dataType === enumDataTypes.FILE).map(el => el.fieldId);
            } else {
                const fields = (await this.getStudyFields(requester, studyId, availableDataVersions)).filter(el => el.dataType === enumDataTypes.FILE).map(el => el.fieldId);
                fieldIds = fieldIds.filter(el => fields.includes(el));
            }
            if (fieldIds.length === 0) {
                return [];
            }
            const fileDataRecords: IData[] = (await this.getData(
                requester,
                studyId,
                fieldIds,
                availableDataVersions,
                undefined,
                false
            )) as unknown as IData[];
            if (!Array.isArray(fileDataRecords)) {
                return [];
            }
            const batchSize = 10000; // Define a suitable batch size
            const promises: Promise<Partial<IFile>[]>[] = [];

            for (let i = 0; i < fileDataRecords.length; i += batchSize) {
                const batchIds = fileDataRecords.slice(i, i + batchSize).map(el => String(el.value));
                const promise = this.db.collections.files_collection.find({ id: { $in: batchIds } }, { allowDiskUse: true })
                    .project({
                        '_id': 0,
                        'fileType': 0,
                        'fileCategory': 0,
                        'sharedUsers': 0,
                        'life.deletedTime': 0,
                        'life.deletedUser': 0
                    }).toArray();
                promises.push(promise);
            }

            const files = (await Promise.all(promises)).flat(); // Flatten the array of arrays
            if (readable) {
                const users = await this.db.collections.users_collection.find({}).toArray();
                const edited = [...files];
                for (const file of edited) {
                    const user = users.find(el => el.id === file.life?.createdUser);
                    if (file.life) {
                        file.life.createdUser = user ? `${user.firstname} ${user.lastname}` : file.life?.createdUser;
                    }
                }
                return edited;
            } else {
                return files;
            }
        };

        if (useCache) {
            const hash = this.utilsCore.computeHash({
                query: 'getStudyFiles',
                studyId: studyId,
                roles: roles,
                fieldIds: selectedFieldIds
            });
            const hashedInfo = await this.db.collections.cache_collection.find({ 'keyHash': hash, 'life.deletedTime': null, 'status': enumCacheStatus.INUSE }).sort({ 'life.createdTime': -1 }).limit(1).toArray();
            // if hash is not found, generate the new summary and cache it
            if (forceUpdate || !hashedInfo || hashedInfo.length === 0) {
                const newFiles = await readFiles();
                const info = await convertToBufferAndUpload(this.fileCore, requester, { files: newFiles });
                await this.db.collections.cache_collection.insertOne({
                    id: uuid(),
                    keyHash: hash,
                    uri: info.uri,
                    status: enumCacheStatus.INUSE,
                    keys: {
                        query: 'getStudyFiles',
                        studyId: studyId,
                        roles: roles,
                        fieldIds: selectedFieldIds
                    },
                    type: enumCacheType.API,
                    life: {
                        createdTime: Date.now(),
                        createdUser: requester.id,
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                });
                return newFiles;
            } else {
                return ((await getJsonFileContents(this.objStore, 'cache', hashedInfo[0].uri)) as unknown as { files: IFile[] }).files;
            }
        } else {
            return await readFiles();
        }

    }


    public async getDataByRoles(requester: IUserWithoutToken, roles: IRole[], studyId: string, dataVersions: Array<string | null>, fieldIds?: string[], fromCold?: boolean) {
        const matchFilter: Filter<IData> = {
            studyId: studyId,
            dataVersion: { $in: dataVersions }
        };

        const dbCollection = fromCold ? this.db.collections.colddata_collection : this.db.collections.data_collection;

        const roleArr: Filter<IData>[] = [];
        for (const role of roles) {
            const permissionArr: Filter<IData>[] = [];
            for (let i = 0; i < role.dataPermissions.length; i++) {
                if (role.dataPermissions[i].fields.length === 0) {
                    continue;
                }
                const obj: Filter<IData> = {
                    fieldId: { $in: role.dataPermissions[i].fields.map(el => new RegExp(el)) }
                };
                if (role.dataPermissions[i].dataProperties) {
                    for (const key of Object.keys(role.dataPermissions[i].dataProperties)) {
                        obj[`properties.${key}`] = { $in: role.dataPermissions[i].dataProperties[key].map(el => new RegExp(el)) };
                    }
                }
                if (!role.dataPermissions[i].includeUnVersioned) {
                    obj['dataVersion'] = { $ne: null };
                }
                permissionArr.push(obj);
            }
            if (permissionArr.length === 0) {
                return [];
            }
            roleArr.push({ $or: permissionArr });
        }

        const availableFields = (await this.getStudyFields(requester, studyId, dataVersions)).reduce((a, c) => {
            a[c.fieldId] = c;
            return a;
        }, {});
        const availableFieldIds = Object.keys(availableFields);
        const refactoredFieldIds = fieldIds ?? Object.keys(availableFields);
        const queryField = async (fieldId: string) => {
            if (availableFieldIds.includes(fieldId) || availableFieldIds.some(el => new RegExp(el).test(fieldId))) {
                const propertyFilter: Record<string, string> = {};
                if (!availableFields[fieldId]) {
                    return [];
                }
                if (availableFields[fieldId].properties) {
                    for (const property of availableFields[fieldId].properties) {
                        propertyFilter[`${property.name}`] = `$properties.${property.name}`;
                    }
                }
                const data = await dbCollection.aggregate<IData>([{
                    $match: {
                        ...matchFilter,
                        fieldId: fieldId,
                        $or: [{ $or: roleArr }, { 'life.createdUser': requester.id }]
                    }
                }, {
                    $sort: {
                        'life.createdTime': -1
                    }
                }, {
                    $group: {
                        _id: {
                            ...propertyFilter
                        },
                        latestDocument: { $first: '$$ROOT' }
                    }
                }, {
                    $replaceRoot: { newRoot: '$latestDocument' }
                }, {
                    $match: {
                        'life.deletedTime': null
                    }
                }, {
                    $project: {
                        _id: 0, // Exclude the _id field
                        id: 0, // Exclude the id field
                        life: 0, // Exclude the life field
                        metadata: 0 // Exclude the metadata field
                    }
                }], { allowDiskUse: true }).toArray();
                return data;
            }

            return [];
        };

        const timedQueryField = async (fieldId: string) => {
            const result = await queryField(fieldId);
            return result; // Return the original result without modification
        };

        let res: IData[] = [];
        const promises = refactoredFieldIds.map(async (fieldId) => timedQueryField(fieldId));
        const results = await Promise.all(promises);

        // Optionally flatten the results if necessary
        res = results.flat();
        return res;
    }

    public genVersioningAggregation(keys: string[], hasVersioning: boolean) {
        const aggregation: Array<{ operationName: enumDataTransformationOperation, params: unknown }> = [];
        if (!hasVersioning) {
            aggregation.push({
                operationName: enumDataTransformationOperation.FILTER, params: {
                    filters: {
                        deleted: [{
                            formula: {
                                type: enumASTNodeTypes.VARIABLE,
                                operation: null,
                                value: 'dataVersion',
                                parameter: {},
                                children: null
                            },
                            condition: enumConditionOps.GENERALISNOTNULL,
                            value: '',
                            parameters: {}
                        }]
                    }
                }
            });
        }
        if (keys.length > 0) {
            aggregation.push({ operationName: enumDataTransformationOperation.GROUP, params: { keys: keys, skipUnmatch: false } });
            aggregation.push({ operationName: enumDataTransformationOperation.LEAVEONE, params: { scoreFormula: { type: enumASTNodeTypes.VARIABLE, operator: null, value: 'life.createdTime', parameters: {}, children: null }, isDescend: true } });
            aggregation.push({
                operationName: enumDataTransformationOperation.FILTER, params: {
                    filters: {
                        deleted: [{
                            formula: {
                                type: enumASTNodeTypes.VARIABLE,
                                operation: null,
                                value: 'life.deletedTime',
                                parameter: {},
                                children: null
                            },
                            condition: enumConditionOps.GENERALISNULL,
                            value: '',
                            parameters: {}
                        }]
                    }
                }
            });
        }
        return aggregation;
    }

    /**
     * Delete data of a study. We add a deleted document in the database.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param fieldId - The id of the field.
     * @param properties - The properties.
     *
     * @return IGenreicResponse - The object of IGenericResponse.
     */
    public async deleteData(requester: IUserWithoutToken | undefined, studyId: string, fieldId: string, properties: Record<string, unknown>): Promise<IGenericResponse> {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const roles = await this.permissionCore.getRolesOfUser(requester, requester.id, studyId);
        if (roles.length === 0 || roles.every(el => el.studyRole !== enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        await this.permissionCore.checkFieldOrDataPermission(requester, studyId, { fieldId: fieldId, properties: properties }, enumDataAtomicPermissions.DELETE);
        await this.db.collections.data_collection.insertOne({
            id: uuid(),
            studyId: studyId,
            fieldId: fieldId,
            dataVersion: null,
            value: null,
            properties: properties,
            life: {
                createdTime: Date.now(),
                createdUser: requester.id,
                deletedTime: Date.now(),
                deletedUser: requester.id
            },
            metadata: {}
        });
        return makeGenericResponse(undefined, undefined, undefined, 'Data deleted.');
    }

    /**
     * Upload a file data.
     *
     * @param requester - The requester.
     * @param studyId - The id of the study.
     * @param file - The file to upload.
     * @param fieldId - The id of the field.
     * @param properties - The properties of the file. Need to match field properties if defined.
     *
     * @return IData
     */
    public async uploadFileData(requester: IUserWithoutToken | undefined, studyId: string, file: FileUpload, fieldId: string, properties?: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, requester.id, studyId);
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }
        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }
        const fileType = (file.filename.split('.').pop() as string).toUpperCase();
        if (!Object.keys(enumFileTypes).includes(fileType)) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                `File type ${fileType} not supported.`
            );
        }
        try {
            const fileEntry = await this.fileCore.uploadFile(
                requester, studyId, null, file, enumFileTypes[fileType], enumFileCategories.STUDY_DATA_FILE, undefined, properties ? JSON.parse(properties) : undefined);
            const dataInput: IDataInput[] = [{
                fieldId: fieldId,
                value: fileEntry.id,
                properties: properties ? {
                    ...JSON.parse(properties),
                    FileName: fileEntry.fileName
                } : undefined
            }];
            const res = await this.uploadData(requester, studyId, dataInput);
            if (!res[0].successful) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    res[0].description ?? 'Failed to upload file.'
                );
            }
            // invalidate the cache
            await this.db.collections.cache_collection.updateMany({ 'keys.studyId': studyId, 'keys.query': 'getStudyFiles' }, { $set: { status: enumCacheStatus.OUTDATED } });
            return fileEntry;
        } catch (error) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                `${(error as Error).message}`
            );
        }
    }

    public async uploadFileDataWithFileEntry(requester: IUserWithoutToken | undefined, studyId: string, fieldId: string, fileEntry: IFile, properties?: string) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }
        const roles = await this.permissionCore.getRolesOfUser(requester, requester.id, studyId);
        if (roles.length === 0) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }
        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }
        try {
            const parsedProperties = properties ? JSON.parse(properties) : {};
            const dataInput: IDataInput[] = [{
                fieldId: fieldId,
                value: fileEntry.id,
                properties: parsedProperties
            }];
            const res = await this.uploadData(requester, studyId, dataInput);
            if (!res[0].successful) {
                throw new CoreError(
                    enumCoreErrors.CLIENT_MALFORMED_INPUT,
                    res[0].description ?? 'Failed to upload file.'
                );
            }
            // invalidate the cache
            await this.db.collections.cache_collection.updateMany({ 'keys.studyId': studyId, 'keys.query': 'getStudyFiles' }, { $set: { status: enumCacheStatus.OUTDATED } });
            return fileEntry;
        } catch (error) {
            throw new CoreError(
                enumCoreErrors.CLIENT_MALFORMED_INPUT,
                `${(error as Error).message}`
            );
        }
    }

    /**
     * Get the summary of a study.
     * Admins can study managers can access this function.
     *
     * @param studyId - The id of the study.
     * @param useCache - Whether to use the cached data.
     * @param forceUpdate - Whether to force update the cache.
     *
     * @return Record<string, any> - The object of Record<string, any>
     */
    public async getStudySummary(requester: IUserWithoutToken | undefined, studyId: string, useCache?: boolean, forceUpdate?: boolean) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        const roles = await this.permissionCore.getRolesOfUser(requester, requester.id, studyId);
        if (requester.type !== enumUserTypes.ADMIN && roles.every(el => el.studyRole !== enumStudyRoles.STUDY_MANAGER)) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const study = await this.db.collections.studies_collection.findOne({ 'id': studyId, 'life.deletedTime': null });
        if (!study) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Study does not exist.'
            );
        }

        const generatedSummary = async () => {
            const [
                numberOfDataRecords,
                numberOfDataDeletes,
                numberOfVersionedDeletes,
                numberOfUnversionedRecords,
                numberOfUnversionedDeletes,
                numberOfFields,
                numberOfUnversionedFields,
                dataByUploaders,
                dataByUsers
            ] = await Promise.all([
                (async () => {
                    const result = await this.db.collections.data_collection.countDocuments({ studyId }, { allowDiskUse: true });
                    return result;
                })(),

                (async () => {
                    const result = await this.db.collections.data_collection.countDocuments({ studyId, value: null }, { allowDiskUse: true });
                    return result;
                })(),
                (async () => {
                    const result = await this.db.collections.data_collection.countDocuments({ studyId, dataVersion: { $ne: null }, value: null }, { allowDiskUse: true });
                    return result;
                })(),
                (async () => {
                    const result = await this.db.collections.data_collection.countDocuments({ studyId, dataVersion: null }, { allowDiskUse: true });
                    return result;
                })(),
                (async () => {
                    const result = await this.db.collections.data_collection.countDocuments({ studyId, dataVersion: null, value: null }, { allowDiskUse: true });
                    return result;
                })(),
                (async () => {
                    const result = (await this.db.collections.field_dictionary_collection.distinct('fieldId', { studyId })).length;
                    return result;
                })(),
                (async () => {
                    const result = (await this.db.collections.field_dictionary_collection.distinct('fieldId', { studyId, dataVersion: null })).length;
                    return result;
                })(),
                (async () => {
                    const result = await this.db.collections.data_collection.aggregate<{ userId: string, count: number }>([
                        { $match: { studyId } },
                        {
                            $group: {
                                _id: '$life.createdUser',
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                userId: '$_id',
                                count: 1
                            }
                        }
                    ], { allowDiskUse: true }).toArray();
                    return result;
                })(),
                (async () => {
                    const result = await this.db.collections.log_collection.aggregate<{ userId: string, count: number }>([
                        {
                            $match: {
                                'parameters.studyId': studyId,
                                'event': { $in: ['GET_DATA_RECORDS', 'GET_STUDY_FIELDS', 'GET_STUDY', 'data.getStudyFields', 'data.getStudyData', 'data.getStudyDataLatest', 'data.getFiles'] }
                            }
                        },
                        {
                            $group: {
                                _id: '$requester',
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                userId: '$_id',
                                count: 1
                            }
                        }
                    ], { allowDiskUse: true }).toArray();
                    return result;
                })()
            ]);

            const numberOfVersionedRecords = numberOfDataRecords - numberOfUnversionedRecords;
            const numberOfDataAdds = numberOfDataRecords - numberOfDataDeletes;
            const numberOfVersionedAdds = numberOfVersionedRecords - numberOfVersionedDeletes;
            const numberOfUnversionedAdds = numberOfUnversionedRecords - numberOfUnversionedDeletes;
            const numberOfVersionedFields = numberOfFields - numberOfUnversionedFields;
            // Return the final result object
            return {
                numberOfDataRecords,
                numberOfDataAdds,
                numberOfDataDeletes,
                numberOfVersionedRecords,
                numberOfVersionedAdds,
                numberOfVersionedDeletes,
                numberOfUnversionedRecords,
                numberOfUnversionedAdds,
                numberOfUnversionedDeletes,
                numberOfFields,
                numberOfVersionedFields,
                numberOfUnversionedFields,
                dataByUploaders,
                dataByUsers
            };
        };

        if (useCache) {
            const hash = this.utilsCore.computeHash({
                query: 'getStudySummary',
                dataVersion: study.currentDataVersion,
                studyId: studyId
            });
            const hashedInfo = await this.db.collections.cache_collection.find({ 'keyHash': hash, 'life.deletedTime': null, 'status': enumCacheStatus.INUSE }).sort({ 'life.createdTime': -1 }).limit(1).toArray();
            // if hash is not found, generate the new summary and cache it
            if (forceUpdate || !hashedInfo || hashedInfo.length === 0) {
                const newStudySummary = await generatedSummary();
                const info = await convertToBufferAndUpload(this.fileCore, requester, newStudySummary);
                await this.db.collections.cache_collection.insertOne({
                    id: uuid(),
                    keyHash: hash,
                    uri: info.uri,
                    status: enumCacheStatus.INUSE,
                    keys: {
                        query: 'getStudySummary',
                        studyId: studyId
                    },
                    type: enumCacheType.API,
                    life: {
                        createdTime: Date.now(),
                        createdUser: requester.id,
                        deletedTime: null,
                        deletedUser: null
                    },
                    metadata: {}
                });
                return newStudySummary;
            } else {
                return (await getJsonFileContents(this.objStore, 'cache', hashedInfo[0].uri)) as unknown as IDataSetSummary;
            }
        } else {
            return await generatedSummary() as IDataSetSummary;
        }
    }

    /* TODO: Data Transformation */
    /* TODO: This is a placeholder in case required. */
    // public async dataTransform(fields: IField[], data: IData[], rules: any) {
    // }

    /**
     * Upload a json object as a file to minio.
     *
     * @param jsonObject - The json object.
     * @param fileName - The name of the file.
     * @param requester - The requester.
     * @returns
     */
    public async convertToBufferAndUpload(
        jsonObject: Record<string, unknown>,
        fileName: string,
        requester: IUserWithoutToken
    ): Promise<IFile> {
        // Convert the JSON object to a buffer
        const buffer = Buffer.from(JSON.stringify(jsonObject));

        // Create a readable stream from the buffer
        const createReadStream = (): Readable => {
            const stream = new Readable();
            stream.push(buffer);
            stream.push(null); // No more data
            return stream;
        };

        // Prepare the file data for upload
        const fileUpload: FileUpload = {
            createReadStream: createReadStream,
            filename: fileName,
            mimetype: 'application/json',
            encoding: 'utf-8'
        };

        // Upload the file using the provided upload function
        return this.fileCore.uploadFile(
            requester,
            null, // studyId
            null, // userId
            fileUpload, // fileUpload
            enumFileTypes.JSON,
            enumFileCategories.CACHE,
            undefined // description
        );
    }

    /**
     * Delete a file from Id. Note this is a function used for GraphQL
     *
     * @param requester - The requester.
     * @param fileId - The id of the file.
     *
     * @returns - The object of IGenericResponse.
     */
    public async deleteFile(requester: IUserWithoutToken | undefined, fileId: string) {
        const data = await this.db.collections.data_collection.findOne({ value: fileId });
        if (!data) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Data entry not found.'
            );
        }
        return await this.deleteData(requester, data.studyId, data.fieldId, data.properties);
    }
}

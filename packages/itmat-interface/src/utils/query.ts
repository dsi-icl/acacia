import { IStudy, IFieldEntry, IStandardization } from '@itmat-broker/itmat-types';
/*
    queryString:
        format: string                  # returned foramt: raw, standardized, grouped, summary
        data_requested: array           # returned fields
        cohort: array[array]            # filters
        new_fields: array               # new_fields

*/
// if has study-level permission, non versioned data will also be returned


export function buildPipeline(query: any, studyId: string, validDataVersion: string, hasPermission: boolean, fieldsIds: string[], siteIDMarker: string | undefined | null) {
    // // parse the input data versions first
    let dataVersionsFilter: any;
    // for data managers; by default will return unversioned data; to return only versioned data, specify a data version
    if (hasPermission) {
        dataVersionsFilter = { $match: { $or: [{ m_versionId: null }, { m_versionId: { $in: validDataVersion } }] } };
    } else {
        dataVersionsFilter = { $match: { m_versionId: { $in: validDataVersion } } };
    }
    const fields = { _id: 0, m_subjectId: 1, m_visitId: 1 };

    // We send back the requested fields, by default send all fields
    if (query['data_requested'] !== undefined && query['data_requested'] !== null) {
        query.data_requested.forEach((field: string) => {
            if (fieldsIds.includes(field)) {
                (fields as any)[field] = 1;
            }
        });
    } else {
        fieldsIds.forEach((field: string) => {
            (fields as any)[field] = 1;
        });
    }
    const addFields = {};
    // We send back the newly created derived fields by default
    if (query['new_fields'] !== undefined && query['new_fields'] !== null) {
        if (query.new_fields.length > 0) {
            query.new_fields.forEach((field: any) => {
                if (field.op === 'derived') {
                    (fields as any)[field.name] = 1;
                    (addFields as any)[field.name] = createNewField(field.value);
                } else {
                    return 'Error';
                }
            });
        }
    }
    let match = {};
    // We send back the filtered fields values
    if (query['cohort'] !== undefined && query['cohort'] !== null) {
        if (query.cohort.length > 1) {
            const subqueries: any = [];
            query.cohort.forEach((subcohort: any) => {
                // addFields.
                subqueries.push(translateCohort(subcohort));
            });
            match = { $or: subqueries };
        } else {
            match = translateCohort(query.cohort[0]);
        }
    }
    // siteIDMarker
    let selfOrgFilter: any;
    if (siteIDMarker === null) {
        selfOrgFilter = { $match: { m_subjectId: { $regex: new RegExp('(.{1})' + '-?(.{6})') } } };
    } else if (siteIDMarker === undefined) {
        selfOrgFilter = { $match: { m_subjectId: null } };
    } else {
        selfOrgFilter = { $match: { m_subjectId: { $regex: new RegExp(siteIDMarker + '-?(.{6})') } } };
    }

    if (isEmptyObject(addFields)) {
        return [
            selfOrgFilter,
            { $match: { m_studyId: studyId } },
            { $match: { $or: [match, { m_versionId: '0' }] } },
            dataVersionsFilter,
            { $sort: { m_subjectId: -1, m_visitId: -1, uploadedAt: -1 } },
            { $project: fields }
        ];
    } else {
        return [
            selfOrgFilter,
            { $match: { m_studyId: studyId } },
            { $addFields: addFields },
            { $match: { $or: [match, { m_versionId: '0' }] } },
            dataVersionsFilter,
            { $sort: { m_subjectId: -1, m_visitId: -1, uploadedAt: -1 } },
            { $project: fields }
        ];
    }
}

function createNewField(expression: any) {
    let newField = {};
    // if any parameters === '99999', then ignore this calculation
    switch (expression.op) {
        case '*':
            newField = {
                $cond: [
                    {
                        $or: [
                            { $eq: [{ $type: createNewField(expression.left) }, 'string'] },
                            { $eq: [{ $type: createNewField(expression.right) }, 'string'] }
                        ]
                    },
                    '99999',
                    {
                        $multiply: [createNewField(expression.left), createNewField(expression.right)]
                    }
                ]
            };
            break;
        case '/':
            newField = {
                $cond: [
                    {
                        $or: [
                            { $eq: [{ $type: createNewField(expression.left) }, 'string'] },
                            { $eq: [{ $type: createNewField(expression.right) }, 'string'] }
                        ]
                    },
                    '99999',
                    {
                        $divide: [createNewField(expression.left), createNewField(expression.right)]
                    }
                ]
            };
            break;
        case '-':
            newField = {
                $cond: [
                    {
                        $or: [
                            { $eq: [{ $type: createNewField(expression.left) }, 'string'] },
                            { $eq: [{ $type: createNewField(expression.right) }, 'string'] }
                        ]
                    },
                    '99999',
                    {
                        $subtract: [createNewField(expression.left), createNewField(expression.right)]
                    }
                ]
            };
            break;
        case '+':
            newField = {
                $cond: [
                    {
                        $or: [
                            { $eq: [{ $type: createNewField(expression.left) }, 'string'] },
                            { $eq: [{ $type: createNewField(expression.right) }, 'string'] }
                        ]
                    },
                    '99999',
                    {
                        $add: [createNewField(expression.left), createNewField(expression.right)]
                    }
                ]
            };
            break;
        case '^':
            newField = {
                $cond: [
                    { $eq: [{ $type: createNewField(expression.left) }, 'string'] },
                    '99999',
                    {
                        $pow: [createNewField(expression.left), createNewField(expression.right)]
                    }
                ]
            };
            break;
        case 'val':
            newField = parseFloat(expression.left);
            break;
        case 'field':
            newField = {
                $cond: [
                    { $eq: [{ $type: createNewField(expression.left) }, 'string'] },
                    '99999',
                    '$' + expression.left
                ]
            };
            break;
        default:
            break;
    }

    return newField;
}


function isEmptyObject(obj: any) {
    return !Object.keys(obj).length;
}


function translateCohort(cohort: any) {
    const match = {};

    cohort.forEach(function (select: any) {

        switch (select.op) {
            case '=':
                // select.value must be an array
                (match as any)[select.field] = { $in: [select.value] };
                break;
            case '!=':
                // select.value must be an array
                (match as any)[select.field] = { $ne: [select.value] };
                break;
            case '<':
                // select.value must be a float
                (match as any)[select.field] = { $lt: parseFloat(select.value) };
                break;
            case '>':
                // select.value must be a float
                (match as any)[select.field] = { $gt: parseFloat(select.value) };
                break;
            case 'derived': {
                // equation must only have + - * /
                const derivedOperation = select.value.split(' ');
                if (derivedOperation[0] === '=') {
                    (match as any)[select.field] = { $eq: parseFloat(select.value) };
                }
                if (derivedOperation[0] === '>') {
                    (match as any)[select.field] = { $gt: parseFloat(select.value) };
                }
                if (derivedOperation[0] === '<') {
                    (match as any)[select.field] = { $lt: parseFloat(select.value) };
                }
                break;
            }
            case 'exists':
                // We check if the field exists. This is to be used for checking if a patient
                // has an image
                (match as any)[select.field] = { $exists: true };
                break;
            case 'count': {
                // counts can only be positive. NB: > and < are inclusive e.g. < is <=
                const countOperation = select.value.split(' ');
                const countfield = select.field + '.count';
                if (countOperation[0] === '=') {
                    (match as any)[countfield] = { $eq: parseInt(countOperation[1], 10) };
                }
                if (countOperation[0] === '>') {
                    (match as any)[countfield] = { $gt: parseInt(countOperation[1], 10) };
                }
                if (countOperation[0] === '<') {
                    (match as any)[countfield] = { $lt: parseInt(countOperation[1], 10) };
                }
                break;
            }
            default:
                break;
        }
    }
    );
    return match;
}

export function dataStandardization(study: IStudy, fields: IFieldEntry[], data: any, queryString: any, standardizations: IStandardization[] | undefined) {
    if (!queryString['format'] || queryString['format'] === 'raw') {
        return data;
    } else if (queryString['format'] === 'grouped' || queryString['format'] === 'summary') {
        return dataGrouping(data, queryString['format']);
    } else if (standardizations && queryString['format'].startsWith('standardized')) {
        return standardize(study, fields, data, standardizations, queryString['new_fields'] || []);
    }
    return { error: 'Format not recognized.' };
}

// fields are obtained from called functions, providing the valid fields
export function standardize(study: IStudy, fields: IFieldEntry[], data: any, standardizations: IStandardization[], newFields: any) {
    const records: any = {};
    const mergedFields: any[] = [...fields];
    [...newFields].forEach(el => {
        const emptyArr: string[] = [];
        preOrderTraversal(el, emptyArr);
        mergedFields.push({ fieldId: emptyArr });
    });
    const seqNumMap: Map<string, number> = new Map();
    for (const field of mergedFields) {
        let fieldDef: any = {};
        for (let i = 0; i < mergedFields.length; i++) {
            if (mergedFields[i].fieldId === field.fieldId) {
                fieldDef = mergedFields[i];
                break;
            }
        }
        // check if it is in the standardizations
        let fieldIdentifier: string | string[] = field.fieldId;
        if (!Array.isArray(field.fieldId)) {
            fieldIdentifier = ['$' + field.fieldId];
        }
        let standardization: IStandardization | undefined = undefined;
        for (let i = 0; i < standardizations.length; i++) {
            if (JSON.stringify(standardizations[i].field) === JSON.stringify(fieldIdentifier)) {
                standardization = standardizations[i];
                break;
            }
        }
        if (!standardization) {
            continue;
        }
        if (!standardization.stdRules || standardization.stdRules.length === 0) {
            continue;
        }
        for (const subjectId of Object.keys(data)) {
            for (const visitId of Object.keys(data[subjectId])) {
                if (!data[subjectId][visitId][field.fieldId]) {
                    continue;
                }
                const dataClip: any = {};
                for (const rule of standardization.stdRules) {
                    if (!rule.parameter) {
                        continue;
                    }
                    if (rule.filters !== undefined && rule.filters !== null && rule.filters[dataClip[rule.entry]] !== undefined
                        && rule.filters[dataClip[rule.entry]][0] === 'delete') {
                        continue;
                    }
                    switch (rule.source) {
                        case 'data': {
                            const chain = rule.parameter || [];
                            let tmpData = data[subjectId][visitId][field.fieldId] || '';
                            chain.forEach(el => {
                                tmpData = tmpData[el] || '';
                            });
                            dataClip[rule.entry] = tmpData;
                            break;
                        }
                        case 'fieldDef': {
                            dataClip[rule.entry] = fieldDef[rule.parameter[0] as keyof IFieldEntry] as any || '';
                            break;
                        }
                        case 'value': {
                            dataClip[rule.entry] = rule.parameter[0] || '';
                            break;
                        }
                        // parameter is the path that start from
                        case 'inc': {
                            const value: number | undefined = incHelper(seqNumMap, rule.parameter, subjectId, visitId);
                            if (value === undefined) {
                                break;
                            }
                            dataClip[rule.entry] = value;
                            break;
                        }
                        case 'reserved': {
                            switch (rule.parameter[0]) {
                                case 'm_subjectId': {
                                    dataClip[rule.entry] = subjectId;
                                    break;
                                }
                                case 'm_visitId': {
                                    dataClip[rule.entry] = visitId;
                                    break;
                                }
                                case 'm_studyId': {
                                    dataClip[rule.entry] = study.id;
                                    break;
                                }
                            }
                            break;
                        }
                        default: {
                            break;
                        }
                    }
                    // deal with filters
                    // support two ways: convert to another value, delete this value; input should be [delete/convert, $value]
                    if (rule.filters) {
                        if (Object.keys(rule.filters).includes(dataClip[rule.entry].toString())) {
                            if (rule.filters[dataClip[rule.entry]].length !== 2) {
                                continue;
                            }
                            switch (rule.filters[dataClip[rule.entry]][0]) {
                                case 'convert': {
                                    dataClip[rule.entry] = rule.filters[dataClip[rule.entry]][1];
                                    break;
                                }
                                case 'delete': {
                                    continue;
                                }
                                default: {
                                    break;
                                }
                            }
                        }
                    }
                }
                // deal with join
                let pointer = insertInObj(records, standardization.path, undefined, true, subjectId, visitId);
                if (pointer === undefined) {
                    pointer = insertInObj(records, standardization.path, [], true, subjectId, visitId);
                }
                if (standardization.joinByKeys.length > 0) {
                    let isSame = true;
                    for (let i = 0; i < pointer.length; i++) {
                        isSame = true;
                        for (let j = 0; j < standardization.joinByKeys.length; j++) {
                            if (pointer[i][standardization.joinByKeys[j]] !== dataClip[standardization.joinByKeys[j]]) {
                                isSame = false;
                                break;
                            }
                        }
                        if (isSame) {
                            pointer[i] = { ...dataClip, ...pointer[i] };
                            break;
                        }
                    }
                    if (isSame && pointer.length !== 0) {
                        insertInObj(records, standardization.path, pointer, true, subjectId, visitId);
                    } else {
                        insertInObj(records, standardization.path, dataClip, false, subjectId, visitId);
                    }
                } else {
                    insertInObj(records, standardization.path, dataClip, false, subjectId, visitId);
                }
            }
        }
    }
    return records;
}

// ignore the subjectId, join values with same visitId and fieldId; with extra info
export function dataGrouping(data: any, format: string) {
    const joinedData: any = {};
    for (const subjectId of Object.keys(data)) {
        for (const visitId of Object.keys(data[subjectId])) {
            for (const fieldId of Object.keys(data[subjectId][visitId])) {
                if (['m_subjectId', 'm_visitId', 'm_versionId'].includes(fieldId)) {
                    continue;
                } else {
                    if (joinedData[fieldId] === undefined) {
                        joinedData[fieldId] = {};
                    }
                    if (joinedData[fieldId][visitId] === undefined) {
                        joinedData[fieldId][visitId] = {
                            totalNumOfRecords: 0,
                            validNumOfRecords: 0,
                            data: []
                        };
                    }
                    if (data[subjectId][visitId][fieldId] !== '99999') {
                        joinedData[fieldId][visitId]['validNumOfRecords'] += 1;
                        // if summary mode; donot return data
                    }
                    if (format !== 'summary') {
                        joinedData[fieldId][visitId]['data'].push(data[subjectId][visitId][fieldId]);
                    }
                    joinedData[fieldId][visitId]['totalNumOfRecords'] += 1;
                }
            }
        }
    }
    return joinedData;
}

function incHelper(map: Map<string, number>, levels: string[], subjectId: string, visitId: string) {
    if (levels.length < 1) {
        return;
    }
    let key = levels[0] === 'm_subjectId' ? subjectId : levels[0] === 'm_visitId' ? visitId : levels[0];
    for (let i = 1; i < levels.length; i++) {
        const modifiedLevel = levels[i] === 'm_subjectId' ? subjectId : levels[0] === 'm_visitId' ? visitId : levels[0];
        key += `-${modifiedLevel}`;
    }
    map.set(key, (map.get(key) || 0) + 1);
    return map.get(key) || 0;
}

// recursively create object structures, return the last pointer
function insertInObj(obj: any, levels: string[], lastValue: any, join: boolean, subjectId: string, visitId: string) {
    let pointer: any = obj;
    for (let i = 0; i < levels.length; i++) {
        let modifiedLevel = levels[i];
        if (levels[i] === 'm_subjectId') {
            modifiedLevel = subjectId;
        } else if (levels[i] === 'm_visitId') {
            modifiedLevel = visitId;
        }
        if (i === levels.length - 1) {
            if (lastValue) {
                if (Array.isArray(pointer[modifiedLevel])) {
                    if (join) {
                        pointer[modifiedLevel] = lastValue;
                    } else {
                        pointer[modifiedLevel].push(lastValue);
                    }
                } else {
                    pointer[modifiedLevel] = lastValue;
                }
            }
            pointer = pointer[modifiedLevel];
            break;
        }
        if (pointer[modifiedLevel] === undefined) {
            pointer[modifiedLevel] = {};
        }
        pointer = pointer[modifiedLevel];
    }
    return pointer;
}

// array[0] should be the name of the new field; array[-1] should be 'derived'
function preOrderTraversal(node: any, array: string[]) {
    if (!node) {
        return false;
    }
    if (node.name) {
        // first level
        array.push(node.name);
        preOrderTraversal(node.value, array);
    }
    // node must have a value of left/right children
    if (node instanceof Object) {
        array.push(node.op);
        if (node.op === 'field') {
            array.push('$' + node.left);
            array.push('');
        } else {
            preOrderTraversal(node.left, array);
            preOrderTraversal(node.right, array);
        }
    } else {
        array.push(node);
    }
    return true;
}

import { IStudy, IField, IStandardization, IQueryString, IGroupedData, StandardizationFilterOptionParameters, StandardizationFilterOptions, IRole } from '@itmat-broker/itmat-types';
import { Filter } from 'mongodb';
/*
    queryString:
        format: string                  # returned foramt: raw, standardized, grouped, summary
        data_requested: array           # returned fields
        cohort: array[array]            # filters
        new_fields: array               # new_fields

*/
// if has study-level permission, non versioned data will also be returned

export function buildPipeline(studyId: string, roles: IRole[], fieldRecords: IField[], dataVersions: Array<string | null>, fieldsRequested?: string[]) {
    let fieldIds: string[] = fieldsRequested ? fieldsRequested : fieldRecords.map(el => el.fieldId);
    fieldIds = fieldIds.filter(el => fieldRecords.map(el => el.fieldId).includes(el));

    const facetFilters = {};
    for (const field of fieldRecords) {
        facetFilters[field.fieldId] = [{ $match: { '_id.fieldId': field.fieldId } }];
        facetFilters[field.fieldId].push({ $unwind: '$docs' });
        facetFilters[field.fieldId].push({
            $group: {
                _id: {
                    ...(field.properties ?? []).reduce((acc, curr) => {
                        acc[curr.name] = `$docs.properties.${curr.name}`;
                        return acc;
                    }, {})
                },
                doc: { $first: '$docs' }
            }
        });
        facetFilters[field.fieldId].push({
            $group: {
                _id: '$_id',
                doc: { $first: '$doc' }
            }
        });
    }

    const userPermissionFilters: Filter<IField>[] = [];
    for (const role of roles) {
        for (const dataPermission of role.dataPermissions) {
            const obj: Filter<IField> = {};

            // Combine regexes using $or
            obj.$or = dataPermission.fields.map(regex => ({ fieldId: { $regex: regex } }));

            for (const property of Object.keys(dataPermission.dataProperties)) {
                obj[`properties.${property}`] = { $in: dataPermission.dataProperties[property] };
            }

            obj.dataVersion = { $in: dataPermission.includeUnVersioned ? dataVersions : dataVersions.filter(el => el !== null) };
            userPermissionFilters.push(obj);
        }
    }
    const pipeline = [{
        $match: { studyId: studyId, fieldId: { $in: fieldIds }, dataVersion: { $in: dataVersions } }
    }, {
        $sort: { 'life.createdTime': -1 }
    }, {
        $group: {
            _id: { fieldId: '$fieldId' },
            docs: { $push: '$$ROOT' }
        }
    }, {
        $facet: {
            ...facetFilters
        }
    }, {
        $project: {
            docs: {
                $setUnion: fieldIds.map(el => ({
                    $ifNull: [`$${el}.doc`, []]
                }))
            }
        }
    }, {
        $unwind: '$docs'
    }, {
        $replaceRoot: { newRoot: '$docs' }
    }, {
        $match: { 'life.deletedTime': { $eq: null } }
    }, {
        $match: { $or: userPermissionFilters }
    }];

    return pipeline;
}

export function dataStandardization(study: IStudy, fields: IField[], data: IGroupedData, queryString: IQueryString, standardizations: IStandardization[] | null) {
    if (!queryString['format'] || queryString['format'] === 'raw') {
        return data;
    } else if (queryString['format'] === 'grouped' || queryString['format'] === 'summary') {
        return dataGrouping(data, queryString['format']);
    } else if (standardizations && queryString['format'].startsWith('standardized')) {
        return standardize(study, fields, data, standardizations);
    }
    return { error: 'Format not recognized.' };
}

// fields are obtained from called functions, providing the valid fields



export function standardize(study: IStudy, fields: IField[], data: IGroupedData, standardizations: IStandardization[]) {
    const records = {};
    const mergedFields: IField[] = [...fields];
    const seqNumMap: Map<string, number> = new Map();
    for (const field of mergedFields) {
        let fieldDef = {};
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
                if (data[subjectId][visitId][field.fieldId] === null || data[subjectId][visitId][field.fieldId] === undefined) {
                    continue;
                }
                const dataClip: Record<string, unknown> = {};
                let isSkip = false;
                if (!standardization.stdRules) {
                    continue;
                }
                for (const rule of standardization.stdRules) {
                    if (!rule.parameter) {
                        continue;
                    }
                    let filterKey = '';
                    if (typeof dataClip[rule.entry] === 'string') {
                        filterKey = dataClip[rule.entry] as string; // Safe after type check
                    } else if (typeof dataClip[rule.entry] === 'number') {
                        filterKey = (dataClip[rule.entry] as number).toString();
                    }
                    if (rule.filters !== undefined && rule.filters !== null && rule.filters[filterKey] !== undefined
                        && rule.filters[filterKey][0] === 'delete') {
                        continue;
                    }
                    switch (rule.source) {
                        case 'data': {
                            if (rule.parameter.length === 0) {
                                dataClip[rule.entry] = data[subjectId][visitId][field.fieldId] || '';
                            } else {
                                const selectedFieldId = rule.parameter[0];
                                const selectedVistId = rule.parameter.length === 2 ? rule.parameter[1] : visitId;
                                dataClip[rule.entry] = data[subjectId][selectedVistId][selectedFieldId] || '';
                            }
                            break;
                        }
                        case 'fieldDef': {
                            dataClip[rule.entry] = fieldDef[rule.parameter[0]] || '';
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
                            isSkip = true;
                            break;
                        }
                    }
                    // deal with filters
                    // support two ways: convert to another value, delete this value; input should be [delete/convert, $value]
                    if (rule.filters) {
                        let filterKey = '';
                        if (typeof dataClip[rule.entry] === 'string') {
                            filterKey = dataClip[rule.entry] as string; // Safe after type check
                        } else if (typeof dataClip[rule.entry] === 'number') {
                            filterKey = (dataClip[rule.entry] as number).toString();
                        }
                        if (Object.keys(rule.filters).includes(filterKey)) {
                            if (rule.filters[filterKey].length !== 2) {
                                continue;
                            }
                            switch (rule.filters[filterKey][0]) {
                                // add patch to allow to convert to another field value
                                case 'convert': {
                                    const options: StandardizationFilterOptionParameters | StandardizationFilterOptions = rule.filters[filterKey][1];
                                    if (typeof options !== 'object') {
                                        break;
                                    }
                                    if ('source' in options) {
                                        if (options.source === 'value') {
                                            dataClip[rule.entry] = options.parameter;
                                        } else if (options.source === 'data') {
                                            dataClip[rule.entry] = data[subjectId][visitId][options.parameter];
                                        }
                                    }
                                    break;
                                }
                                case 'delete': {
                                    isSkip = true;
                                    break;
                                }
                                default: {
                                    isSkip = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (isSkip) {
                    continue;
                }
                // deal with join
                if (standardization.path) {
                    let pointer = insertInObj(records, standardization.path, undefined, true, subjectId, visitId);
                    if (pointer === undefined) {
                        pointer = insertInObj(records, standardization.path, [], true, subjectId, visitId);
                    }
                    if (standardization.joinByKeys && standardization.joinByKeys.length > 0) {
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
    }
    return records;
}

// ignore the subjectId, join values with same visitId and fieldId; with extra info
export function dataGrouping(data: IGroupedData, format: string) {
    const joinedData: {
        [key: string]: {
            [key: string]: {
                totalNumOfRecords: number,
                validNumOfRecords: number,
                data: unknown[]
            }
        }
    } = {};
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
function insertInObj(obj, levels: string[], lastValue: unknown, join: boolean, subjectId: string, visitId: string) {
    let pointer = obj;
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



export function buildPipeline(query: any, studyId: string, availableDataVersions: any) {
    // parse the input data versions first
    let dataVersionsFilter: any;
    if (availableDataVersions == null) {
        dataVersionsFilter = null;
    } else {
        dataVersionsFilter = { $in: availableDataVersions };
    }

    // if query is undefined, return all data with specified data versions
    if (query === undefined) {
        return [
            { $match: { m_studyId: studyId } },
            { $match: { m_versionId: dataVersionsFilter } },
        ];
    }

    // check query, then decide whether to parse the query
    if (query['data_requested'] === undefined || query['cohort'] === undefined || query['new_fields'] === undefined) {
        return null;
    }
    if (Array.isArray(query['data_requested']) === false || Array.isArray(query['cohort']) === false || Array.isArray(query['new_fields']) === false) {
        return null;
    }
    const fields = { _id: 0, m_eid: 1 };
    // We send back the requested fields
    query.data_requested.forEach((field: any) => {
        (fields as any)[field] = 1;
    });
    const addFields = {};
    // We send back the newly created derived fields by default
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
    let match = {};
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

    if (isEmptyObject(addFields)) {
        return [
            { $match: { m_studyId: studyId } },
            { $match: { deleted: null } },
            { $match: match },
            { $match: { m_versionId: dataVersionsFilter } },
            { $project: fields }
        ];
    } else {
        return [
            { $match: { m_studyId: studyId } },
            { $match: { deleted: null } },
            { $addFields: addFields },
            { $match: match },
            { $match: { m_versionId: dataVersionsFilter } },
            { $project: fields }
        ];
    }
}

function createNewField(expression: any) {
    let newField = {};
    switch (expression.op) {
        case '*':
            newField = {
                $multiply: [createNewField(expression.left), createNewField(expression.right)]
            };
            break;
        case '/':
            newField = {
                $divide: [createNewField(expression.left), createNewField(expression.right)]
            };
            break;
        case '-':
            newField = {
                $subtract: [createNewField(expression.left), createNewField(expression.right)]
            };
            break;
        case '+':
            newField = {
                $add: [createNewField(expression.left), createNewField(expression.right)]
            };
            break;
        case '^':
            // NB the right side my be an integer while the left must be a field !
            newField = {
                $pow: ['$' + expression.left, parseInt(expression.right, 10)]
            };
            break;
        case 'val':
            newField = parseFloat(expression.left);
            break;
        case 'field':
            newField = '$' + expression.left;
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

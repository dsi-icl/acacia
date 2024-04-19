// /**
//  * @fn QueryHelper
//  * @desc Helper to manipulate and query the MongoDB database storing UK biobank data formatted in the
//  * white paper format
//  * @param config
//  * @constructor
//  */

import { ICohortSelection, IEquationDescription, IQueryEntry, IStudyDataVersion } from '@itmat-broker/itmat-types';

class PipelineGenerator {
    constructor(private readonly config = {}) { }

    /*
    * @fn buildPipeline
    * @desc Methods that builds thee pipeline for the mongo query
    * @param query
    * structure of the request
    * {
        "new_fields": [
            {
            "name": String // Name of the new field
            "value": String // equation defining the derived feature
            "op": String // Derived only
            }
        ],
        "cohort": [
            [{
            "field": String, // Field identifier or field in the form X.X for a count
            "value": String Or Float, // Value requested can either categorical
            "op": String // Logical operation
            },
            {
            "field": String, // Field identifier or field in the form X.X for a count
            "value": String Or Float, // Value requested can either categorical
            "op": String // Logical operation
            }
        ],
        [
        {
            "field": String, // Field identifier or field in the form X.X for a count
            "value": String Or Float, // Value requested can either categorical
            "op": String // Logical operation
            }
        ]],
        "data_requested": [ "field1",  "field2", "field3"] // Fields requested
        }
    }
    */
    public buildPipeline(query: IQueryEntry['queryString'], studyId: string, availableDataVersions: Array<IStudyDataVersion | null | undefined>) {
        // check query, then decide whether to parse the query
        if (query['data_requested'] === undefined || query['cohort'] === undefined || query['new_fields'] === undefined) {
            return null;
        }
        if (Array.isArray(query['data_requested']) === false || Array.isArray(query['cohort']) === false || Array.isArray(query['new_fields']) === false) {
            return null;
        }

        const fields = { _id: 0, m_subjectId: 1, m_visitId: 1 };
        // We send back the requested fields
        query.data_requested.forEach((field) => {
            fields[field] = 1;
        });
        const addFields = {};
        // We send back the newly created derived fields by default
        if (query.new_fields.length > 0) {
            query.new_fields.forEach((field) => {
                if (field.op === 'derived') {
                    fields[field.name] = 1;
                    addFields[field.name] = this._createNewField(field.value);
                } else {
                    return 'Error';
                }
            });
        }
        let match = {};
        if (query.cohort.length > 1) {
            const subqueries = [];
            query.cohort.forEach((subcohort) => {
                // addFields.
                subqueries.push(this._translateCohort(subcohort));
            });
            match = { $or: subqueries };
        } else {
            match = this._translateCohort(query.cohort[0]);
        }
        let dataVersionsFilter;
        if (availableDataVersions == null) {
            dataVersionsFilter = null;
        } else {
            dataVersionsFilter = { $in: availableDataVersions };
        }
        if (this._isEmptyObject(addFields)) {
            return [
                { $match: { m_studyId: studyId } },
                { $match: match },
                { $match: { m_versionId: dataVersionsFilter } },
                { $project: fields }
            ];
        } else {
            return [
                { $match: { m_studyId: studyId } },
                { $addFields: addFields },
                { $match: match },
                { $match: { m_versionId: dataVersionsFilter } },
                { $project: fields }
            ];
        }
    }


    /**
     * @fn _createNewdField
     * @desc Creates the new fields required to compare when using an expresion like BMI or an average
     * expression = {
     *   "left": json for nested or string for field id or Float,
     *   "right": json for nested or string for field id or Float,
     *   "op": String // Logical operation
     * @param expression
     * @return json formated in the mongo format in the pipeline stage addfield
     * @private
     */
    private _createNewField(expression: IEquationDescription) {
        let newField = {};
        switch (expression.op) {
            case '*':
                newField = {
                    $multiply: [this._createNewField(expression.left), this._createNewField(expression.right)]
                };
                break;
            case '/':
                newField = {
                    $divide: [this._createNewField(expression.left), this._createNewField(expression.right)]
                };
                break;
            case '-':
                newField = {
                    $subtract: [this._createNewField(expression.left), this._createNewField(expression.right)]
                };
                break;
            case '+':
                newField = {
                    $add: [this._createNewField(expression.left), this._createNewField(expression.right)]
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

    /**
     * @fn _isEmptyObject
     * @desc tests if an object is empty
     * @param obj
     * @returns {boolean}
     * @private
     */
    private _isEmptyObject(obj: unknown) {
        return obj ? !Object.keys(obj).length : true;
    }

    /**
     * @fn _translateCohort
     * @desc Tranforms a query into a mongo query.
     * @param cohorts
     * @private
     */
    private _translateCohort(cohorts: ICohortSelection[]) {
        const match: Record<string, unknown> = {};

        cohorts.forEach(function (select) {

            switch (select.op) {
                case '=':
                    // select.value must be an array
                    match[select.field] = { $in: [select.value] };
                    break;
                case '!=':
                    // select.value must be an array
                    match[select.field] = { $ne: [select.value] };
                    break;
                case '<':
                    // select.value must be a float
                    match[select.field] = { $lt: parseFloat(select.value) };
                    break;
                case '>':
                    // select.value must be a float
                    match[select.field] = { $gt: parseFloat(select.value) };
                    break;
                case 'derived': {
                    // equation must only have + - * /
                    const derivedOperation = select.value.split(' ');
                    if (derivedOperation[0] === '=') {
                        match[select.field] = { $eq: parseFloat(select.value) };
                    }
                    if (derivedOperation[0] === '>') {
                        match[select.field] = { $gt: parseFloat(select.value) };
                    }
                    if (derivedOperation[0] === '<') {
                        match[select.field] = { $lt: parseFloat(select.value) };
                    }
                    break;
                }
                case 'exists':
                    // We check if the field exists. This is to be used for checking if a patient
                    // has an image
                    match[select.field] = { $exists: true };
                    break;
                case 'count': {
                    // counts can only be positive. NB: > and < are inclusive e.g. < is <=
                    const countOperation = select.value.split(' ');
                    const countfield = select.field + '.count';
                    if (countOperation[0] === '=') {
                        match[countfield] = { $eq: parseInt(countOperation[1], 10) };
                    }
                    if (countOperation[0] === '>') {
                        match[countfield] = { $gt: parseInt(countOperation[1], 10) };
                    }
                    if (countOperation[0] === '<') {
                        match[countfield] = { $lt: parseInt(countOperation[1], 10) };
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
}


export const pipelineGenerator = Object.freeze(new PipelineGenerator());

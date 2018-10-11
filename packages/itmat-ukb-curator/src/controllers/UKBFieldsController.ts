import express from 'express';
import { UKBFields } from '../curation/UKBFields';
import { Models, CustomError } from 'itmat-utils';

export function getFieldInfo(req: express.Request, res: express.Response): void {
    if (!req.query.fieldId) { // req must have a 'fieldId' query string that is a number
        res.status(400).json(new CustomError(Models.APIModels.Errors.missingQueryString(['fieldId'])));
        return;
    }

    if (typeof req.query.fieldId !== 'string') { //if the query string is doubled it will be an array
        res.status(400).json(new CustomError(Models.APIModels.Errors.duplicateQueryString`fieldId`));
        return;
    }

    if (isNaN(req.query.fieldId) || req.query.fieldId.indexOf('.') !== -1 || req.query.fieldId.indexOf('-') !== -1) { //checking fieldId is a valid number
        res.status(400).json(new CustomError(Models.APIModels.Errors.invalidUKBFieldIDQueryString));
        return;
    }

    UKBFields.getFieldInfo(parseInt(req.query.fieldId)).then(
        fieldEntry => {
            if (!fieldEntry) {
                res.status(404).json(new CustomError(Models.APIModels.Errors.entryNotFound('field')));
                return;
            }
            res.status(200).json(fieldEntry);
            return;
        }
    );
}
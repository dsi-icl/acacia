import express from 'express';
import { UKBFields } from '../curation/UKBFields';
import { DataEntry } from '../curation/UKBData';
import { CustomError, Models } from 'itmat-utils';

export function addData(req: express.Request, res: express.Response): void {

    const body = req.body;
    if (!body || !body.UKBDecode || !body.entry) { //check if the body has the necessary keys
        res.status(400).json(new CustomError(Models.APIModels.Errors.missingRequestKey('body', ['UKBDecode', 'entry'])));
        return;
    }
    
    const entry: DataEntry = body.entry;
    if (!entry.patientId || !entry.fieldId || !entry.value) {
        res.status(400).json(new CustomError(Models.APIModels.Errors.missingRequestKey('entry', ['patientId', 'field', 'value'])));
        return;
    }

}
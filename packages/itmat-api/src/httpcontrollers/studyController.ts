import { ItmatAPIReq } from '../server/requests';
import { Database } from '../database/database';
import { Models, RequestValidationHelper, CustomError, OpenStackSwiftObjectStore, Logger } from 'itmat-utils';
import { Express, Request, Response, NextFunction } from 'express';
import mongodb from 'mongodb';

export class StudyController {
    constructor(private readonly studyCollection: mongodb.Collection) {
        this.createStudy = this.createStudy.bind(this);
        this.getStudies = this.getStudies.bind(this);
    }

    public async createStudy(req: Request, res: Response): Promise<void> {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkForAdminPrivilege()
            .checkRequiredKeysArePresentIn<Models.Study.IStudy>(Models.APIModels.Enums.PlaceToCheck.BODY, ['name'])
            .checkForValidDataTypeForValue(req.body.name, Models.Enums.JSDataType.STRING, 'name')
            .checksFailed) { return; }

        const studyEntry: Models.Study.IStudy = {
            name: req.body.name,
            createdBy: req.user!.username
        };

        try {
            await this.studyCollection.insertOne(studyEntry);
        } catch (e) {
            console.log(e);
            res.status(500).json(new CustomError('Cannot create study', e));
            return;
        }

        res.status(200).json({ message: `Study '${req.body.name}' has been created.` });
        return;
    }

    public async getStudies(req: Request, res: Response): Promise<void> {
        const validator = new RequestValidationHelper(req, res);
        if (validator
            .checkForAdminPrivilege()
            .checksFailed) { return; }

        let result: Models.Study.IStudy[];

        try {
            const cursor = this.studyCollection.find({}, { projection: { _id: 0 } });
            result = await cursor.toArray();
            res.status(200).json(result);
            return;
        } catch (e) {
            console.log(e);
            res.status(500).json(new CustomError('Cannot get studies.'));
            return;
        }
    }
}
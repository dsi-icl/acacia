import express from 'express';
import bodyParser from 'body-parser';
import * as UKBFieldsController from '../controllers/UKBFieldsController';
import * as UKBDataController from '../controllers/UKBDataController';

export class Router {
    constructor() {
        const app = express();

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        
        app.route('/field')
            .get(UKBFieldsController.getFieldInfo); //get field info // req must have a 'fieldId' query string that is a number

        app.route('/data')
            .post(UKBDataController.addData);
            
        return app;
    }
}
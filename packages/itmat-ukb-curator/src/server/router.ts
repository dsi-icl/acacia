import express, { Express } from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import * as UKBFieldsController from '../controllers/UKBFieldsController';
import * as UKBDataController from '../controllers/UKBDataController';
import { CSVStorageEngine } from '../controllers/storageEngine';
import timeout from 'connect-timeout';


const upload = multer({ storage: CSVStorageEngine });

export class Router {
    constructor() {
        const app: Express = express();

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(timeout('86400000'));
        
        app.route('/field')
            .get(UKBFieldsController.getFieldInfo); //get field info // req must have a 'fieldId' query string that is a number

        app.route('/data')
            .post(upload.fields([{ name: 'UKBCSVFile', maxCount: 1 }]), (req, res) => { console.log('file', (req.files as any).UKBCSVFile ); res.send('yes'); });  //TODO: check for undefined file;
            
        return app;
    }
}
import express, { Express } from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import * as UKBFieldsController from '../controllers/UKBFieldsController';
import timeout from 'connect-timeout';
import { test_fileUploadController } from '../controllers/test_fileUploadController';

const upload = multer();

export class Router {
    constructor() {
        const app: Express = express();

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(timeout('86400000'));
        app.route('/jobs/:jobId/:fileName/test_fileUpload')
            .post(upload.single('file'), test_fileUploadController);

        return app;
    }
}
import express, { Express } from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import timeout from 'connect-timeout';
import { test_fileUploadController } from '../controllers/test_fileUploadController';

const upload = multer();

export class Router {
    private readonly app: Express;

    constructor() {
        this.app = express();

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        this.app.use(timeout('86400000'));
        this.app.route('/jobs/:jobId/:fileName/test_fileUpload')
            .post(upload.single('file'), test_fileUploadController);
    }

    public getApp(): Express {
        return this.app;
    }
}
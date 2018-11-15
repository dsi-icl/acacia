import express, { Express } from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import timeout from 'connect-timeout';

const upload = multer();

export class Router {
    private readonly app: Express;

    constructor() {
        this.app = express();

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        this.app.use(timeout('86400000'));
    }

    public getApp(): Express {
        return this.app;
    }
}
import express, { Express } from 'express';
import bodyParser from 'body-parser';
import timeout from 'connect-timeout';

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
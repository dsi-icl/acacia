import timeout from 'connect-timeout';
import express, { Express } from 'express';
import rateLimit from 'express-rate-limit';

export class Router {
    private readonly app: Express;

    constructor() {
        this.app = express();

        this.app.use(rateLimit({
            windowMs: 1 * 60 * 1000,
            max: 500
        }));

        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(timeout('86400000'));
    }

    public getApp(): Express {
        return this.app;
    }
}

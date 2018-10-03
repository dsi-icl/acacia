import express from 'express';
import { Server, CustomError } from 'itmat-utils';
import { APIDatabase, APIDatabaseConfig } from '../database/database';
import { Router } from './router';


interface APIServerConfig {
    database: APIDatabaseConfig,
    server: {
        port: number
    },
    bcrypt: {
        saltround: number
    }
}

export class APIServer extends Server<APIServerConfig> {
    private readonly port: number;

    constructor(config: APIServerConfig) {
        super(config);
        this.port = config.server.port;
    }

    protected async initialise(): Promise<express.Application> {
        try {  //try to establish a connection to database first; if failed, exit the program
            await APIDatabase.connect(this.config.database);
        } catch (e) {
            const { mongo_url: mongoUri, database } = this.config.database;
            console.log(
                new CustomError(`Cannot connect to database host ${mongoUri} - db = ${database}.`, e)
            );
            process.exit(1);
        }

        if (isNaN(parseInt(this.config.bcrypt.saltround as any))) {
            console.log(
                new CustomError('Salt round must be a number')
            );
            process.exit(1);
        } 

        return new Router() as express.Application;
    }

    public async start(): Promise<void> {
        const app: express.Application = await this.initialise();
        app.listen(this.port, () => { console.log(`I am listening on port ${this.port}!`); });
    }
}

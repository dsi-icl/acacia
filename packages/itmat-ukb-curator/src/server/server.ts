import express from 'express';
import { Server, Database, databaseConfig, CustomError } from 'itmat-utils';
import { Router } from './router';


interface UKBCuratorServerConfig {
    database: databaseConfig,
    server: {
        port: number
    }
}

export class UKBCuratorServer extends Server<UKBCuratorServerConfig> {
    private readonly port: number;

    constructor(config: UKBCuratorServerConfig) {
        super(config);
        this.port = config.server.port;
    }

    public async initialise(): Promise<express.Application> {
        try {  //try to establish a connection to database first; if failed, exit the program
            await Database.connect(this.config.database);
        } catch (e) {
            const { mongo_url: mongoUri, database } = this.config.database;
            console.log(
                new CustomError(`Cannot connect to database host ${mongoUri} - db = ${database}.`, e)
            );
            process.exit(1);
        }

        return new Router() as express.Application;
    }

    public async start(): Promise<void> {
        const app: express.Application = await this.initialise();
        app.listen(this.port, () => { console.log(`Listening on port ${this.port}`); });
    }
}

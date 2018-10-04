import express from 'express';
import { Server, DatabaseConfig, CustomError } from 'itmat-utils';
import { UKBCurationDatabase, UKBDatabaseConfig } from '../database/database';
import { Router } from './router';


interface UKBCuratorServerConfig {
    database: UKBDatabaseConfig,
    server: {
        port: number
    }
}

export class UKBCuratorServer extends Server<UKBCuratorServerConfig> {
    protected async initialise(): Promise<express.Application> {
        try {  //try to establish a connection to database first; if failed, exit the program
            await UKBCurationDatabase.connect(this.config.database);
        } catch (e) {
            const { mongo_url: mongoUri, database } = this.config.database;
            console.log(
                new CustomError(`Cannot connect to database host ${mongoUri} - db = ${database}.`, e)
            );
            process.exit(1);
        }

        return new Router() as express.Application;
    }
}

import express from 'express';
import { Server, DatabaseConfig, CustomError, ServerConfig } from 'itmat-utils';
import { UKBCurationDatabase, UKBDatabaseConfig } from '../database/database';
import { Express, Request, Response, NextFunction } from 'express';
import { Router } from './router';


interface UKBCuratorServerConfig extends ServerConfig{
    database: UKBDatabaseConfig
}

export class UKBCuratorServer extends Server<UKBCuratorServerConfig> {
    protected async initialise(): Promise<Express> {
        try {  //try to establish a connection to database first; if failed, exit the program
            await UKBCurationDatabase.connect(this.config.database);
        } catch (e) {
            const { mongo_url: mongoUri, database } = this.config.database;
            console.log(
                new CustomError(`Cannot connect to database host ${mongoUri} - db = ${database}.`, e)
            );
            process.exit(1);
        }

        return new Router() as Express;
    }
}

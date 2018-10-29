import express from 'express';
import { Server, IDatabaseConfig, CustomError, IServerConfig, Models } from 'itmat-utils';
import { UKBCurationDatabase, IUKBDatabaseConfig } from '../database/database';
import { Express, Request, NextFunction } from 'express';
import { changeStreamListener } from '../controllers/changeStreamListener';
import { Router } from './router';
import fetch, { Response } from 'node-fetch';
import { objectStore } from '../objectStore/OpenStackObjectStore'; 

interface IUKBCuratorServerConfig extends IServerConfig{
    database: IUKBDatabaseConfig
}

export class UKBCuratorServer extends Server<IUKBCuratorServerConfig> {
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

        try {  //try to establish a connection to database first; if failed, exit the program
            await objectStore.connect();
            console.log('connected to object store');
        } catch (e) {
            console.log(
                new CustomError(`Cannot connect to object store.`, e)
            );
            process.exit(1);
        }

        UKBCurationDatabase.changeStream.on('change', changeStreamListener);

        return new Router() as Express;
    }
}

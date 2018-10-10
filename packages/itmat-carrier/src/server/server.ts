import express from 'express';
import { Server, CustomError, ServerConfig } from 'itmat-utils';
import { CarrierDatabase, CarrierDatabaseConfig } from '../database/database';
import { Router } from './router';
import { Express, Request, Response, NextFunction } from 'express';
import { objectStore, IOpenSwiftObjectStoreConfig } from '../objectStore/OpenStackObjectStore';

interface CarrierServerConfig extends ServerConfig {
    database: CarrierDatabaseConfig,
    swift: IOpenSwiftObjectStoreConfig
}

export class CarrierServer extends Server<CarrierServerConfig> {
    protected async initialise(): Promise<Express> {
        try {  //try to establish a connection to database first; if failed, exit the program
            await CarrierDatabase.connect(this.config.database);
        } catch (e) {
            const { mongo_url: mongoUri, database } = this.config.database;
            console.log(
                new CustomError(`Cannot connect to database host ${mongoUri} - db = ${database}.`, e)
            );
            process.exit(1);
        }

        try {  //try to establish a connection to database first; if failed, exit the program
            await objectStore.connect();
        } catch (e) {
            console.log(
                new CustomError(`Cannot connect to object store.`, e)
            );
            process.exit(1);
        }
        
        return new Router() as Express;
    }
}

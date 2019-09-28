import { Express } from 'express';
import { Database, IDatabaseBaseConfig, IDatabase } from './database';
import { MongoClient } from 'mongodb';
import { CustomError } from './error';
import { Logger } from './logger';
import { IOpenSwiftObjectStoreConfig, OpenStackSwiftObjectStore } from './OpenStackObjectStore';
import { Server } from 'http';

export interface IServerBaseConfig {
    server: {
        port: number
    }
}

export abstract class ServerBase<T extends IServerBaseConfig> {

    protected config: T;

    constructor(config: T) {
        this.config = config;
    }

    protected abstract additionalChecksAndActions(): Promise<void>;
}

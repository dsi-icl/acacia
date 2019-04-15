import { Express } from 'express';
import { Database, IDatabaseBaseConfig, IDatabase } from './database';
import { MongoClient } from 'mongodb';
import { CustomError } from './error';
import { Logger } from './logger';
import { IOpenSwiftObjectStoreConfig, OpenStackSwiftObjectStore } from './OpenStackObjectStore';

export interface IServerBaseConfig {
    port: number
}

export abstract class ServerBase<T extends IServerBaseConfig> {
    constructor(
        protected readonly config: T,
        protected readonly db: IDatabase, // db is connected
        protected readonly objStore: OpenStackSwiftObjectStore) {} // objStore is connected

    public async start(router: Express): Promise<void> {
        const port = this.config.port;
        router.listen(port, () => {
            Logger.log(`I am listening on port ${port}!`);
        }).on('error', err => {
            Logger.error(`Cannot start server..maybe port ${port} is already in use?`);
            process.exit(1);
        });
    }

    protected abstract additionalChecksAndActions(): Promise<void>;
}

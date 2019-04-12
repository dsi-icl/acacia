import { Express } from 'express';
import { Database, IDatabaseBaseConfig } from './database';
import { MongoClient } from 'mongodb';
import { CustomError } from './error';
import { Logger } from './logger';
import { IOpenSwiftObjectStoreConfig, OpenStackSwiftObjectStore } from './OpenStackObjectStore';

export interface IServerBaseConfig<D extends IDatabaseBaseConfig> {
    server: {
        port: number
    },
    database: D,
    swift: IOpenSwiftObjectStoreConfig
}

export abstract class ServerBase<D extends IDatabaseBaseConfig, T extends IServerBaseConfig<D>> {
    constructor(
        protected readonly config: T,
        protected readonly db: Database<D>,
        protected readonly objStore: OpenStackSwiftObjectStore) {}

    public async connectToBackEnd(): Promise<void> {
        try {  // try to establish a connection to database first; if failed, exit the program
            await this.db.connect();
        } catch (e) {
            const { mongo_url: mongoUri, database } = this.config.database;
            Logger.error(
                new CustomError(`Cannot connect to database host ${mongoUri} - db = ${database}.`, e)
            );
            process.exit(1);
        }

        try {  // try to establish a connection to database first; if failed, exit the program
            await this.objStore.connect();
            Logger.log('connected to object store');
        } catch (e) {
            Logger.log(
                new CustomError('Cannot connect to object store.', e)
            );
            process.exit(1);
        }

        await this.additionalChecksAndActions();
    }

    public async start(router: Express): Promise<void> {
        const port = this.config.server.port;
        router.listen(port, () => {
            Logger.log(`I am listening on port ${port}!`);
        }).on('error', err => {
            Logger.error(`Cannot start server..maybe port ${port} is already in use?`);
            process.exit(1);
        });
    }

    protected abstract additionalChecksAndActions(): Promise<void>;
}

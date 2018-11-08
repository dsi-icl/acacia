import { Express } from 'express';
import { DatabaseBase, IDatabaseBaseConfig } from './database';
import { MongoClient } from 'mongodb';
import { CustomError } from './error';
import { IOpenSwiftObjectStoreConfig, OpenStackSwiftObjectStore } from './OpenStackObjectStore';

export interface IServerBaseConfig<D extends IDatabaseBaseConfig> {
    server: {
        port: number
    },
    database: D,
    swift: IOpenSwiftObjectStoreConfig
}

export abstract class ServerBase<D extends IDatabaseBaseConfig, K extends DatabaseBase<D>, T extends IServerBaseConfig<D>> {
    constructor(
        protected readonly config: T,
        protected readonly db: K,
        protected readonly objStore: OpenStackSwiftObjectStore) {}

    public async connectToBackEnd(): Promise<void> {
        try {  // try to establish a connection to database first; if failed, exit the program
            await this.db.connect();
        } catch (e) {
            const { mongo_url: mongoUri, database } = this.config.database;
            console.log(
                new CustomError(`Cannot connect to database host ${mongoUri} - db = ${database}.`, e)
            );
            process.exit(1);
        }

        await this.additionalChecks();

        try {  // try to establish a connection to database first; if failed, exit the program
            await this.objStore.connect();
            console.log('connected to object store');
        } catch (e) {
            console.log(
                new CustomError('Cannot connect to object store.', e)
            );
            process.exit(1);
        }
    }

    public async start(router: Express): Promise<void> {
        const port = this.config.server.port;
        router.listen(port, () => {
            console.log(`I am listening on port ${port}!`);
        }).on('error', err => {
            console.log(`Cannot start server..maybe port ${port} is already in use?`, err);
            process.exit(1);
        });
    }

    protected abstract additionalChecks(): Promise<void>;
}

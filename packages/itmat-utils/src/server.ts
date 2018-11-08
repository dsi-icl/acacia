import { Express } from 'express';
import { Database, IDatabaseConfig } from './database';
import { MongoClient } from 'mongodb';
import { CustomError } from './error';
import { IOpenSwiftObjectStoreConfig, OpenStackSwiftObjectStore } from './OpenStackObjectStore';

export interface IServerConfig<D extends IDatabaseConfig> {
    server: {
        port: number
    },
    database: D,
    swift: IOpenSwiftObjectStoreConfig
}

export abstract class Server<D extends IDatabaseConfig, K extends Database<D>, T extends IServerConfig<D>> {
    constructor(protected readonly config: T, public readonly db: K, public readonly objStore: OpenStackSwiftObjectStore, private readonly router: Express) {}

    public async start(): Promise<void> {
        await this.initialise();
        const port = this.config.server.port;

        this.router.listen(port, () => {
            console.log(`I am listening on port ${port}!`);
        }).on('error', err => {
            console.log(`Cannot start server..maybe port ${port} is already in use?`, err);
            process.exit(1);
        });
    }

    protected abstract additionalChecks(): Promise<void>;

    protected async initialise(): Promise<void> {
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
}

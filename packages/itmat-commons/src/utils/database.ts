import type { MongoClient, Db, Collection } from 'mongodb';
import { CustomError } from './error';
import { Logger } from './logger';

export interface IDatabaseBaseConfig {
    mongo_url: string;
    database: string;
    collections: {
        [collectionDescription: string]: string  // collection name
    };
}

export interface IDatabase<Conf, Colls> {
    collections?: Colls;
    connect: (
        config: Conf,
        mongoClient: typeof MongoClient
    ) => Promise<MongoClient>;
    db: Db;
    client?: MongoClient;
    closeConnection: () => Promise<void>;
}

export class Database<configType extends IDatabaseBaseConfig, C = Record<keyof configType['collections'], Collection>> implements IDatabase<configType, C> {

    get db(): Db {
        if (!this.localClient || !this.config) {
            throw new Error('Client error.');
        }
        return this.localClient.db(this.config.database);
    }

    get client(): MongoClient {
        if (!this.localClient) {
            throw new Error('Client error.');
        }
        return this.localClient;
    }

    // This assumes that the collections are already present in the database
    // This assumes the server will never proceed if the database is not connected
    public collections: C = {} as C;
    private localClient?: MongoClient;
    private config?: configType;

    public async connect(
        config: configType,
        mongoClient: typeof MongoClient
    ): Promise<MongoClient> {
        this.config = config;
        const shouldOutput = process.env['JEST_WORKER_ID'] !== undefined;
        if (shouldOutput) Logger.log('Connecting to the database..');
        /* any error throw here will be caught by the server */
        this.localClient = await (new mongoClient(config.mongo_url)).connect();
        if (shouldOutput) Logger.log('Connected to database.');

        if (shouldOutput) Logger.log('Performing basic checks..');
        await this.checkAllCollectionsArePresent();
        if (shouldOutput) Logger.log('Done basic checks.');

        this.assignCollections();

        if (shouldOutput) Logger.log('Finished with database initialisation.');
        return this.localClient;
    }

    public async closeConnection(): Promise<void> {
        try {
            if (this.localClient)
                await this.localClient.close();
        } catch (e) {
            if (e instanceof Error)
                Logger.error(new CustomError('Cannot close Mongo connection', e));
            else
                Logger.error(new CustomError('Cannot close Mongo connection - unknown error'));
        }
    }

    private assignCollections(): void {
        if (!this.config) {
            throw new Error('Config Missing.');
        }
        const collections = Object.entries(this.config.collections).reduce((a, e) => {
            a[e[0]] = this.db.collection(e[1]);
            return a;
        }, {} as Record<string, Collection>) as C;
        this.collections = collections;
    }

    private async checkAllCollectionsArePresent(): Promise<void> {
        if (!this.config) {
            throw new Error('Config Missing.');
        }
        const collectionList: string[] = (await this.db.listCollections({}).toArray()).map((el) => el.name);
        for (const each of Object.values(this.config.collections)) {
            if (!collectionList.includes(each)) {
                throw new CustomError(`Collection ${each} does not exist.`);
            }
        }
    }
}

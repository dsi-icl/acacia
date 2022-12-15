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

export interface IDatabase<Conf, Coll> {
    collections?: Coll;
    connect: (
        config: Conf,
        mongoClient: typeof MongoClient
    ) => Promise<MongoClient>;
    db: Db;
    client?: MongoClient;
    closeConnection: () => Promise<void>;
}

export class Database<configType extends IDatabaseBaseConfig, C = { [name in keyof configType['collections']]: Collection }> implements IDatabase<configType, C> {

    get db(): Db {
        return this.localClient!.db(this.config!.database);
    }

    get client(): MongoClient | undefined {
        return this.localClient;
    }
    public collections?: C;
    private localClient?: MongoClient;
    private config?: configType;

    public async connect(
        config: configType,
        mongoClient: typeof MongoClient
    ): Promise<MongoClient> {
        this.config = config;
        const shouldOutput = process.env['JEST_WORKER_ID'] !== undefined;
        shouldOutput && Logger.log('Connecting to the database..');
        /* any error throw here will be caught by the server */
        this.localClient = await (new mongoClient(config.mongo_url)).connect();
        shouldOutput && Logger.log('Connected to database.');

        shouldOutput && Logger.log('Performing basic checks..');
        await this.checkAllCollectionsArePresent();
        shouldOutput && Logger.log('Done basic checks.');

        this.assignCollections();

        shouldOutput && Logger.log('Finished with database initialisation.');
        return this.localClient;
    }

    public async closeConnection(): Promise<void> {
        try {
            if (this.localClient)
                await this.localClient.close();
        } catch (e: any) {
            Logger.error(new CustomError('Cannot close Mongo connection', e));
        }
    }

    private assignCollections(): void {
        const collections: C = Object.entries(this.config!.collections).reduce((a: any, e: [string, string]) => {
            a[e[0]] = this.db.collection(e[1]);
            return a;
        }, {});
        this.collections = collections;
    }

    private async checkAllCollectionsArePresent(): Promise<void> {
        const collectionList: string[] = (await this.db.listCollections({}).toArray()).map((el) => el.name);
        for (const each of Object.values(this.config!.collections)) {
            if (!collectionList.includes(each)) {
                throw new CustomError(`Collection ${each} does not exist.`);
            }
        }
    }
}

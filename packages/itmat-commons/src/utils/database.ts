import * as mongodb from 'mongodb';
import { CustomError } from './error';
import { Logger } from './logger';

export interface IDatabaseBaseConfig {
    mongo_url: string;
    database: string;
    collections: {
        [collectionDescription: string]: string  // collection name
    };
}

export interface IDatabase {
    collections?: any;
    connect: (
        config: any,
        mongoClientConnect: (uri: string, options?: mongodb.MongoClientOptions) => Promise<mongodb.MongoClient>
    ) => Promise<void>;
    db: mongodb.Db;
    client: mongodb.MongoClient;
    closeConnection: () => Promise<void>;
}

export class Database<configType extends IDatabaseBaseConfig, C = { [name in keyof configType['collections']]: mongodb.Collection }> implements IDatabase {

    get db(): mongodb.Db {
        return this.localClient!.db(this.config!.database);
    }

    get client(): mongodb.MongoClient {
        return this.localClient!;
    }
    public collections?: C;
    private localClient?: mongodb.MongoClient;
    private config?: configType;

    public async connect(
        config: configType,
        mongoClientConnect: (uri: string, options?: mongodb.MongoClientOptions) => Promise<mongodb.MongoClient>
    ): Promise<void> {
        this.config = config;
        Logger.log('Connecting to the database..');
        /* any error throw here will be caught by the server */
        this.localClient = await mongoClientConnect(config.mongo_url);
        Logger.log('Connected to database.');

        Logger.log('Performing basic checks..');
        await this.checkAllCollectionsArePresent();
        Logger.log('Done basic checks.');

        this.assignCollections();

        Logger.log('Finished with database initialisation.');
    }

    public async closeConnection(): Promise<void> {
        try {
            await this.localClient!.close();
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

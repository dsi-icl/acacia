import * as mongodb from 'mongodb';
import { CustomError } from './error';
import { Logger } from './logger';

export interface IDatabaseBaseConfig {
    mongo_url: string,
    database: string,
    collections: {
        [collectionDescription: string]: string  // collection name
    }
}

export class Database<configType extends IDatabaseBaseConfig, C = {[name in keyof configType['collections']]: mongodb.Collection} > {
    private _client: mongodb.MongoClient;
    public collections?: C;

    constructor(protected readonly config: configType) {
        this._client = new mongodb.MongoClient(config.mongo_url, { useNewUrlParser: true });
    }

    public async connect(): Promise<void> {
        if (!this.isConnected()) {
            Logger.log('Connecting to the database..');
            /* any error throw here will be caught by the server */
            await this._client.connect();
            Logger.log('Connected to database.');

            Logger.log('Performing basic checks..');
            await this.checkAllCollectionsArePresent();
            Logger.log('Done basic checks.');

            this.assignCollections();

            Logger.log('Finished with database initialisation.');
        } else {
            Logger.warn('Called connect function on an already connected database instance.');
        }
    }

    get db(): mongodb.Db {
        return this._client.db(this.config.database);
    }

    get client(): mongodb.MongoClient {
        return this._client;
    }

    public isConnected(): boolean {
        return this._client.isConnected();
    }

    public async closeConnection(): Promise<void> {
        try {
            await this._client.close();
        } catch (e) {
            Logger.error(new CustomError('Cannot close Mongo connection', e));
        }
    }

    private assignCollections(): void {
        const collections: C = Object.entries(this.config.collections).reduce((a: any, e: [string, string]) => {
            a[e[0]] = this.db.collection(e[1]);
            return a;
        }, {});
        this.collections = collections;
    }

    private async checkAllCollectionsArePresent(): Promise<void> {
        const collectionList: string[] = (await this.db.listCollections({}).toArray()).map(el => el.name);
        for (const each of Object.values(this.config.collections)) {
            if (!collectionList.includes(each)) {
                throw new CustomError(`Collection ${each} does not exist.`);
            }
        }
    }
}

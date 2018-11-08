import mongodb, { MongoClient, Db } from 'mongodb';
import { CustomError } from './error';

export interface IDatabaseConfig {
    mongo_url: string,
    database: string,
    collections: {
        [collectionDescription: string]: string  // collection name
    }
}

export abstract class Database<configType extends IDatabaseConfig> {
    protected client: mongodb.MongoClient;

    constructor(protected readonly config: configType) {
        this.client = new mongodb.MongoClient(config.mongo_url, { useNewUrlParser: true });
    }

    public async connect(): Promise<void> {
        if (!this.isConnected()) {
            console.log('Connecting to the database..');
            /* any error throw here will be caught by the server */
            await this.client.connect();
            console.log('Connected.');

            console.log('Performing basic checks..');
            await this.checkAllCollectionsArePresent(this.getDB());
            console.log('Done.');

            this.assignCollections();

            console.log('Finished with database initialisation.');
        } else {
            console.warn('[Warning] Called connect function on an already connected database instance.');
        }
    }

    public getDB(): Db {
        return this.client.db(this.config.database);
    }

    public isConnected(): boolean {
        return this.client.isConnected();
    }

    public async closeConnection(): Promise<void> {
        try {
            await this.client.close();
        } catch (e) {
            console.log(new CustomError('Cannot close Mongo connection', e));
        }
    }

    protected abstract assignCollections(): void;

    private async checkAllCollectionsArePresent(db: mongodb.Db): Promise<void> {
        const collectionList: string[] = (await db.listCollections({}).toArray()).map(el => el.name);
        for (const each of Object.values(this.config.collections)) {
            if (!collectionList.includes(each)) {
                throw new CustomError(`Collection ${each} does not exist.`);
            }
        }
    }
}

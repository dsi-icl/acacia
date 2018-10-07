import mongodb from 'mongodb';
import { DatabaseConfig, Database, CustomError } from 'itmat-utils';

export interface APIDatabaseConfig extends DatabaseConfig {
    users_collection: string,
    jobs_collection: string
}

export class APIDatabase extends Database {
    protected static db: mongodb.Db;
    protected static config: APIDatabaseConfig;
    public static jobs_collection: mongodb.Collection;
    public static users_collection: mongodb.Collection;

    public static async connect(config: APIDatabaseConfig): Promise<void> {
        if (!this.db) {
            /* any error throw here should be caught by the server calling this function */
            console.log('Connecting to the database..');
            const client: mongodb.MongoClient = await mongodb.MongoClient.connect(config.mongo_url, { useNewUrlParser: true });
            this.db = client.db(config.database);
            this.config = config;
            console.log('Connected.');

            /* checking the collections are already present; can change to create if not exist but gives warning */
            let collectionList: any[] = await this.db.listCollections({}).toArray();
            collectionList = collectionList.map(el => el.name) as string[];
            for (let each of [config.jobs_collection, config.users_collection]) {
                if (!collectionList.includes(each)) {
                    throw new CustomError(`Collection ${each} does not exist.`);
                }
            }

            this.jobs_collection = this.db.collection(config.jobs_collection);
            this.users_collection = this.db.collection(config.users_collection);
        }
    }

    public static getDB(): mongodb.Db {
        return this.db;
    }

}
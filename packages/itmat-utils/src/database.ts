import mongodb from 'mongodb';

export interface databaseConfig {
    mongo_url: string,
    database: string,
    UKB_coding_collection: string,
    UKB_field_dictionary_collection: string
}

/**
 * @class Database
 * @description Database.connect() represents a single connection to mongo
 */

export class Database {
    private static db: mongodb.Db;
    private static config: databaseConfig;
    public static UKB_coding_collection: mongodb.Collection;
    public static UKB_field_dictionary_collection: mongodb.Collection;

    public static async connect(config: databaseConfig): Promise<void> {
        if (!this.db) {
            /* any error throw here will be caught by the server */
            const client: mongodb.MongoClient = await mongodb.MongoClient.connect(config.mongo_url, { useNewUrlParser: true });
            this.db = client.db(config.database);
            this.config = config;
            this.UKB_coding_collection = this.db.collection(config.UKB_coding_collection);
            this.UKB_field_dictionary_collection = this.db.collection(config.UKB_field_dictionary_collection);
        }
    }

    public static async flushCodingCollection(): Promise<void> {
        try {
            await this.UKB_coding_collection.drop();
            await this.db.createCollection(this.config.UKB_coding_collection);
            this.UKB_coding_collection = this.db.collection(this.config.UKB_coding_collection);
            await this.UKB_coding_collection.createIndex({ Coding: 1, Value: 1 });
        } catch (e) {

        }
    }
}
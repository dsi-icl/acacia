import mongodb from 'mongodb';

export interface DatabaseConfig {
    mongo_url: string,
    database: string,
    jobs_collection: string
}

/**
 * @class Database
 * @description Database.connect() represents a single connection to mongo
 */

export class Database {
    /* USAGE IN PACKAGES:
    1. either extend the class and override connect or use it as is; depending on the package's needs
    2. use the connect function in server.initialise() for setup.
    */
    protected static db: mongodb.Db;
    protected static config: DatabaseConfig;

    public static async connect(config: DatabaseConfig): Promise<void> {
        if (!this.db) {
            /* any error throw here will be caught by the server */
            const client: mongodb.MongoClient = await mongodb.MongoClient.connect(config.mongo_url, { useNewUrlParser: true });
            this.db = client.db(config.database);
            this.config = config;
        }
    }
}
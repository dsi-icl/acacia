import mongodb from 'mongodb';
import { IDatabaseConfig, Database, CustomError } from 'itmat-utils';

export interface IAPIDatabaseConfig extends IDatabaseConfig {
    collections: {
        users_collection: string,
        jobs_collection: string
    }
}

export class APIDatabase extends Database<IAPIDatabaseConfig> {
    public jobs_collection?: mongodb.Collection;
    public users_collection?: mongodb.Collection;

    protected assignCollections(): void {
        const db = this.client.db(this.config.database);
        this.jobs_collection = db.collection(this.config.collections.jobs_collection);
        this.users_collection = db.collection(this.config.collections.users_collection);
    }
}
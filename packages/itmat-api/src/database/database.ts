import mongodb from 'mongodb';
import { IDatabaseBaseConfig, DatabaseBase, CustomError } from 'itmat-utils';

export interface IDatabaseConfig extends IDatabaseBaseConfig {
    collections: {
        users_collection: string,
        jobs_collection: string
    }
}

export class Database extends DatabaseBase<IDatabaseConfig> {
    public jobs_collection?: mongodb.Collection; // tslint:disable-line
    public users_collection?: mongodb.Collection; // tslint:disable-line

    protected assignCollections(): void {
        const db = this.client.db(this.config.database);
        this.jobs_collection = db.collection(this.config.collections.jobs_collection);
        this.users_collection = db.collection(this.config.collections.users_collection);
    }
}
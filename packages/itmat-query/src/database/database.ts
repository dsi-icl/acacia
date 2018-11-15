import mongodb from 'mongodb';
import { IDatabaseBaseConfig, DatabaseBase, CustomError } from 'itmat-utils';

export interface IDatabaseConfig extends IDatabaseBaseConfig {
    collections: {
        UKB_data_collection: string,
        query_collection: string
    }
}

export class Database extends DatabaseBase<IDatabaseConfig> {
    public query_collection?: mongodb.Collection; // tslint:disable-line
    public UKB_data_collection?: mongodb.Collection; // tslint:disable-line

    protected assignCollections(): void {
        const db = this.getDB();
        this.UKB_data_collection = db.collection(this.config.collections.UKB_data_collection);
        this.query_collection = db.collection(this.config.collections.query_collection);
    }
}
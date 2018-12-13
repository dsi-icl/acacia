import mongodb from 'mongodb';
import { IDatabaseBaseConfig, DatabaseBase, CustomError } from 'itmat-utils';

export interface IDatabaseConfig extends IDatabaseBaseConfig {
    collections: {
        jobs_collection: string,
        UKB_coding_collection: string,
        UKB_field_dictionary_collection: string,
        data_collection: string
    }
}

export class Database extends DatabaseBase<IDatabaseConfig> {
    public jobs_collection?: mongodb.Collection; // tslint:disable-line
    public UKB_coding_collection?: mongodb.Collection; // tslint:disable-line
    public UKB_field_dictionary_collection?: mongodb.Collection; // tslint:disable-line
    public data_collection?: mongodb.Collection; // tslint:disable-line

    protected assignCollections(): void {
        const db = this.getDB();
        this.jobs_collection = db.collection(this.config.collections.jobs_collection);
        this.UKB_coding_collection = db.collection(this.config.collections.UKB_coding_collection);
        this.UKB_field_dictionary_collection = db.collection(this.config.collections.UKB_field_dictionary_collection);
        this.data_collection = db.collection(this.config.collections.data_collection);
    }
}
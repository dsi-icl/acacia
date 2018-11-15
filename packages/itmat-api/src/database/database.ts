import mongodb from 'mongodb';
import { IDatabaseBaseConfig, DatabaseBase, CustomError } from 'itmat-utils';

export interface IDatabaseConfig extends IDatabaseBaseConfig {
    collections: {
        users_collection: string,
        jobs_collection: string,
        studies_collection: string,
        queries_collection: string
    }
}

export class Database extends DatabaseBase<IDatabaseConfig> {
    public jobs_collection?: mongodb.Collection; // tslint:disable-line
    public users_collection?: mongodb.Collection; // tslint:disable-line
    public studies_collection?: mongodb.Collection; // tslint:disable-line
    public queries_collection?: mongodb.Collection; // tslint:disable-line

    protected assignCollections(): void {
        const db = this.getDB();
        this.jobs_collection = db.collection(this.config.collections.jobs_collection);
        this.users_collection = db.collection(this.config.collections.users_collection);
        this.studies_collection = db.collection(this.config.collections.studies_collection);
        this.queries_collection = db.collection(this.config.collections.queries_collection);
    }
}
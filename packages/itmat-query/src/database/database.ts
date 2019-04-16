import mongodb from 'mongodb';
import { IDatabaseBaseConfig, Database } from 'itmat-utils';

export interface IDatabaseConfig extends IDatabaseBaseConfig {
    collections: {
        data_collection: string,
        queries_collection: string,
        projects_collection: string
    }
}

export type Database = Database<IDatabaseBaseConfig>;
export const db = new Database();
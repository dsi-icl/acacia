import { Database as DatabaseBase, IDatabaseBaseConfig } from '@itmat/utils';

export interface IDatabaseConfig extends IDatabaseBaseConfig {
    collections: {
        jobs_collection: string,
        UKB_coding_collection: string,
        field_dictionary_collection: string,
        data_collection: string
    };
}

export type Database = DatabaseBase<IDatabaseBaseConfig>;
export const db: any = new DatabaseBase();

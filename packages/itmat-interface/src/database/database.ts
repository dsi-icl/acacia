import { Database, IDatabaseBaseConfig } from 'itmat-commons';

export interface IDatabaseConfig extends IDatabaseBaseConfig {
    collections: {
        users_collection: string,
        jobs_collection: string,
        studies_collection: string,
        projects_collection: string,
        queries_collection: string,
        field_dictionary_collection: string,
        roles_collection: string,
        files_collection: string,
        log_collection: string
    };
}

export const db = new Database();

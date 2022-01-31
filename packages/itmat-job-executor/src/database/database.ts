import { Database as DatabaseBase, IDatabaseBaseConfig, IFile, IProject } from 'itmat-commons';
import type { Collection } from 'mongodb';

export interface IDatabaseConfig extends IDatabaseBaseConfig {
    collections: {
        jobs_collection: string,
        UKB_coding_collection: string,
        field_dictionary_collection: string,
        files_collection: string,
        data_collection: string,
        queries_collection: string,
        projects_collection: string
    };
}

export interface IDatabaseCollectionConfig {
    jobs_collection: Collection,
    UKB_coding_collection: Collection,
    field_dictionary_collection: Collection,
    files_collection: Collection<IFile>,
    data_collection: Collection,
    queries_collection: Collection,
    projects_collection: Collection<IProject>
}

export const db = new DatabaseBase<IDatabaseBaseConfig, IDatabaseCollectionConfig>();

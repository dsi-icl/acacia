import type { IFile, IJobEntry, IProject, IQueryEntry, IDataEntry } from '@itmat-broker/itmat-types';
import { Database as DatabaseBase, IDatabaseBaseConfig } from '@itmat-broker/itmat-commons';
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
    jobs_collection: Collection<IJobEntry<any>>,
    UKB_coding_collection: Collection,
    field_dictionary_collection: Collection,
    files_collection: Collection<IFile>,
    data_collection: Collection<IDataEntry>,
    queries_collection: Collection<IQueryEntry>,
    projects_collection: Collection<IProject>
}

export const db = new DatabaseBase<IDatabaseBaseConfig, IDatabaseCollectionConfig>();

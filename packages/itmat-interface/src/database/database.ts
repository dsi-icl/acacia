import type { IDataEntry, IFieldEntry, IFile, IJobEntry, ILogEntry, IOrganisation, IProject, IPubkey, IQueryEntry, IRole, IStudy, IUser, IStandardization } from '@itmat-broker/itmat-types';
import { Database as DatabaseBase, IDatabaseBaseConfig } from '@itmat-broker/itmat-commons';
import type { Collection } from 'mongodb';

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
        organisations_collection: string,
        log_collection: string,
        pubkeys_collection: string,
        data_collection: string,
        standardizations_collection: string,
    };
}

export interface IDatabaseCollectionConfig {
    users_collection: Collection<IUser>,
    jobs_collection: Collection<IJobEntry<any>>,
    studies_collection: Collection<IStudy>,
    projects_collection: Collection<IProject>,
    queries_collection: Collection<IQueryEntry>,
    field_dictionary_collection: Collection<IFieldEntry>,
    roles_collection: Collection<IRole>,
    files_collection: Collection<IFile>,
    organisations_collection: Collection<IOrganisation>,
    log_collection: Collection<ILogEntry>,
    pubkeys_collection: Collection<IPubkey>,
    data_collection: Collection<IDataEntry>,
    standardizations_collection: Collection<IStandardization>,
}

export const db = new DatabaseBase<IDatabaseBaseConfig, IDatabaseCollectionConfig>();

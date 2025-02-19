import * as mongo from 'mongodb';
import { v4 as uuid } from 'uuid';
import { seedUsers } from './seed/users';
import { seedOrganisations } from './seed/organisations';
import { seedConfigs } from './seed/config';
const collections = {
    jobs_collection: {
        name: 'JOB_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    users_collection: {
        name: 'USER_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { 'username': 1, 'life.deletedTime': 1 }, unique: true },
            { key: { 'email': 1, 'life.deletedTime': 1 }, unique: true }
        ]
    },
    studies_collection: {
        name: 'STUDY_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { 'name': 1, 'life.deletedTime': 1 }, unique: true }
        ]
    },
    queries_collection: {
        name: 'QUERY_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    log_collection: {
        name: 'LOG_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    data_collection: {
        name: 'DATA_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { 'studyId': 1, 'fieldId': 1, 'life.createdTime': 1, 'life.deletedTime': 1, 'properties': 1 }, unique: true }
        ]
    },
    roles_collection: {
        name: 'ROLE_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    field_dictionary_collection: {
        name: 'FIELD_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { 'studyId': 1, 'fieldId': 1, 'life.createdTime': 1, 'life.deletedTime': 1, 'properties': 1, 'dataVersion': 1 }, unique: true }
        ]
    },
    files_collection: {
        name: 'FILES_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    organisations_collection: {
        name: 'ORGANISATION_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { name: 1 }, unique: true }
        ]
    },
    sessions_collection: {
        name: 'SESSIONS_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    pubkeys_collection: {
        name: 'PUBKEY_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { pubkey: 1 }, unique: true }
        ]
    },
    standardizations_collection: {
        name: 'STANDARDIZATION_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    configs_collection: {
        name: 'CONFIG_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { type: 1, key: 1 }, unique: true }
        ]
    },
    ontologies_collection: {
        name: 'ONTOLOGY_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    drives_collection: {
        name: 'DRIVE_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    colddata_collection: {
        name: 'COLDDATA_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { 'studyId': 1, 'fieldId': 1, 'life.createdTime': 1, 'life.deletedTime': 1, 'properties': 1 }, unique: true }
        ]
    },
    cache_collection: {
        name: 'CACHE_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { 'keyHash': 1, 'type': 1, 'life.createdTime': 1 }, unique: true }
        ]
    },
    domains_collection: {
        name: 'DOMAIN_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { domainPath: 1 }, unique: true }
        ]
    },
    docs_collection: {
        name: 'DOC_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
        ]
    },
    webauthn_collection: {
        name: 'WEBAUTHN_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { userId: 1 }, unique: false }
        ]
    },
    instance_collection: {
        name: 'INSTANCE_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { userId: 1 }, unique: false }
        ]
    }
};

export async function setupDatabase(mongostr: string, databaseName: string): Promise<void> {
    console.log('Setting up database');
    const conn = await mongo.MongoClient.connect(mongostr);
    const db = conn.db(databaseName);
    const existingCollections = (await db.listCollections({}).toArray()).map((el) => el.name);
    /* creating collections and indexes */
    for (const each of Object.keys(collections) as Array<keyof typeof collections>) {
        if (existingCollections.includes(collections[each].name)) {
            await db.dropCollection(collections[each].name);
        }
        const collection = await db.createCollection(collections[each].name);
        await collection.createIndexes(collections[each].indexes as Array<mongo.IndexDescription>);
    }


    /* replace the user id from the seeds */
    seedUsers[0].id = uuid();
    seedUsers[1].id = uuid();

    /* insert seed users */
    await db.collection(collections.users_collection.name).insertMany(seedUsers);

    /* insert seed organisations */
    await db.collection(collections.organisations_collection.name).insertMany(seedOrganisations);

    /* Insert necessary configs */
    await db.collection(collections.configs_collection.name).insertMany(seedConfigs);

    await conn.close();
}

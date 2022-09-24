import * as mongo from 'mongodb';
import { v4 as uuid } from 'uuid';
import { seedUsers } from './seed/users';
import { seedOrganisations } from './seed/organisations';
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
            { key: { username: 1, deleted: 1 }, unique: true },
            { key: { email: 1, deleted: 1 }, unique: true }
        ]
    },
    studies_collection: {
        name: 'STUDY_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { name: 1, deleted: 1 }, unique: true }
        ]
    },
    projects_collection: {
        name: 'PROJECT_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { name: 1, studyId: 1, deleted: 1 }, unique: true }
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
            { key: { id: 1, m_subjectId: 1, m_versionId: 1, m_studyId: 1, m_visitId: 1, uploadedAt: 1 }, unique: true }
        ]
    },
    roles_collection: {
        name: 'ROLE_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true },
            { key: { name: 1, studyId: 1, projectId: 1, deleted: 1 }, unique: true }
        ]
    },
    field_dictionary_collection: {
        name: 'FIELD_COLLECTION',
        indexes: [
            { key: { id: 1 }, unique: true }
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
    }
};

export async function setupDatabase(mongostr: string, databaseName: string): Promise<void> {
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

    await conn.close();
}

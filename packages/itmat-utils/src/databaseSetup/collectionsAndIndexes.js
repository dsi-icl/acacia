const mongo = require('mongodb');
const uuid = require('uuid/v4');
const seedUsers = require('./seed/users');

const collections = {
    "jobs_collection": {
        name: "1JOB_COLLECTION",
        indexes: []
    },
    "users_collection": {
        name: "1USER_COLLECTION",
        indexes: [
            { key: { username: 1, deleted: 1 }, unique: true  },
            { key: { email: 1, deleted: 1 }, unique: true } 
        ]
    },
    "studies_collection": { 
        name: "1STUDY_COLLECTION",
        indexes: [
            { key: { name: 1, deleted: 1 }, unique: true }
        ]
    },
    "projects_collection": { 
        name: "1PROJECT_COLLECTION",
        indexes: [
            { key: { name: 1, studyId: 1, deleted: 1 }, unique: true }
        ]
    },
    "queries_collection": { 
        name: "1QUERY_COLLECTION",
        indexes: []
    },
    "log_collection": {
        name: "1LOG_COLLECTION",
        indexes: []
    },
    "data_collection": {
        name: "1DATA_COLLECTION",
        indexes: []
    },
    "roles_collection": {
        name: "1ROLE_COLLECTION",
        indexes: [
            { key: { name: 1, studyId: 1, projectId: 1, deleted: 1 }, unique: true }
        ]
    },
    "field_dictionary_collection": {
        name: "1FIELD_COLLECTION",
        indexes: [

        ]
    },
    "files_collection": {
        name: "1FILES_COLLECTION",
        indexes: []
    }
};

async function setupDatabase(mongostr, databaseName) {
    const conn = await mongo.MongoClient.connect(mongostr, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    const db = conn.db(databaseName);

    /* creating collections and indexes */
    for (let each of Object.keys(collections)) {
        const collection = await db.createCollection(collections[each].name);
        const indexes = await collection.createIndexes([
            { key: { id: 1 }, unique: true },
            ...collections[each].indexes
        ]);
    }
    

    /* replace the id from the seeds */
    seedUsers[0].id = uuid();
    seedUsers[1].id = uuid();

    /* insert seed users */
    await db.collection(collections.users_collection.name).insert(seedUsers);

    await conn.close();
};

setupDatabase('mongodb://localhost:27017/', 'itmat').then(() => {
    console.log('Finished setting up database.');
});

module.exports = setupDatabase;
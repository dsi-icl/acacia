'use strict';
const mongodb = require('mongodb');
const { JobUtils } = require('../../dist/src/utils/jobUtils');
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;

let mongod;
let APIDatabase = {};

const entry = {
    id: 'f21409-jtr134kjlf1-2jr12fe1wkp1',
    type: 'UPLOAD',
    files: ['phenotype.csv'],
    jobType: 'UKB_CSV_UPLOAD',
    requester: 'admin',
    filesReceived: [],
    numberOfFilesToTransfer: 1,
    numberOfTransferredFiles: 0,
    created: new Date().valueOf(),
    status: 'WAITING',
    carrier: 'hardcoded CARIER URL',
    error: null
};

beforeAll(async () => {
    mongod = new MongoMemoryServer();
    const mongoUri = await mongod.getConnectionString();
    const dbName = await mongod.getDbName();
    const client = await mongodb.MongoClient.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    APIDatabase.jobs_collection = client.db(dbName).collection('job');
});

afterAll(() => {
    mongod.stop();
});


describe('Job utils', () => {
    test('createNewJob', async () => {
        const result = await JobUtils.createNewJob(entry);
        expect(result.insertedCount).toBe(1);
    });
});
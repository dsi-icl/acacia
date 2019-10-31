const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('./config');
 
const mongod = new MongoMemoryServer();

/* Creating a in-memory MongoDB instance for testing */
const connectionString = await mongodb.getConnectionString();
const database = await mongodb.getDbName();
const mongoClient = new MongoClient(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

module.exports = { connectionString, database, mongoClient };